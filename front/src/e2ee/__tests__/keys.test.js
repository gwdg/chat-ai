import { describe, expect, it, vi } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";

import { E2eeKeyError, b64e, keyId } from "../protocol";
import {
  fetchKeyDirectory,
  fetchKeyFromUrl,
  keyEntryFromText,
  mergeKeyImport,
  parseKeyDirectory,
  publicKeyFileText,
} from "../keys";

const publicKeyBytes = x25519.getPublicKey(x25519.utils.randomSecretKey());
const publicKey = b64e(publicKeyBytes);
const otherPublicKey = b64e(
  x25519.getPublicKey(x25519.utils.randomSecretKey()),
);
const kid = keyId(publicKeyBytes);

const response = (body, init = {}) =>
  new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain" },
    ...init,
  });

const fetchImpl = (map) =>
  vi.fn(async (url) => {
    const value = map[url];
    if (value === undefined) return response("missing", { status: 404 });
    if (value instanceof Error) throw value;
    return response(value);
  });

describe("keyEntryFromText", () => {
  it("parses a bare key and derives the id from its fingerprint", () => {
    const entry = keyEntryFromText(publicKey);
    expect(entry.id).toBe(`key-${kid}`);
    expect(entry.kid).toBe(kid);
    expect(entry.publicKey).toBe(publicKey);
    expect(entry.source).toBe("paste");
    expect(entry.name).toBe("");
  });

  it("keeps an explicit id, name and url", () => {
    const entry = keyEntryFromText(`${publicKey}\n`, {
      id: "node-a",
      name: "Node A",
      url: "https://example.org/node-a.pub",
      source: "url",
    });
    expect(entry).toMatchObject({
      id: "node-a",
      name: "Node A",
      url: "https://example.org/node-a.pub",
      source: "url",
    });
  });

  it("ignores comments, blank lines and an ssh-style prefix", () => {
    const text = `# Node A public key\n\nssh-ed25519 ${publicKey} node@example\n`;
    const entry = keyEntryFromText(text, { name: "Node A" });
    expect(entry.publicKey).toBe(publicKey);
    expect(entry.kid).toBe(kid);
  });

  it("rejects text that is not a public key", () => {
    expect(() => keyEntryFromText("")).toThrow(E2eeKeyError);
    expect(() => keyEntryFromText("not a key!")).toThrow(E2eeKeyError);
    expect(() => keyEntryFromText(b64e(new Uint8Array(31)))).toThrow(
      E2eeKeyError,
    );
  });
});

describe("parseKeyDirectory", () => {
  it("reads inline keys and their model lists", () => {
    const directory = parseKeyDirectory({
      keys: [
        { id: "node-a", name: "Node A", publicKey, models: ["qwen-a", "qwen-b"] },
        { id: "node-b", key: otherPublicKey },
      ],
    });
    expect(directory.keys[0]).toMatchObject({
      id: "node-a",
      name: "Node A",
      publicKey,
      url: "",
      models: ["qwen-a", "qwen-b"],
    });
    expect(directory.keys[1]).toMatchObject({
      id: "node-b",
      publicKey: otherPublicKey,
    });
    expect(directory.models).toEqual({});
  });

  it("accepts a JSON string and the publicKeys alias", () => {
    const directory = parseKeyDirectory(
      JSON.stringify({ publicKeys: [{ id: "node-a", pubkey: publicKey }] }),
    );
    expect(directory.keys).toHaveLength(1);
    expect(directory.keys[0].publicKey).toBe(publicKey);
  });

  it("reads a model map and drops empty entries", () => {
    const directory = parseKeyDirectory({
      keys: [{ id: "node-a", publicKey }],
      models: { "qwen-a": "node-a", "": "node-a", "qwen-b": "" },
    });
    expect(directory.models).toEqual({ "qwen-a": "node-a" });
  });

  it("rejects a document without keys or models", () => {
    expect(() => parseKeyDirectory({ keys: [] })).toThrow(E2eeKeyError);
    expect(() => parseKeyDirectory([])).toThrow(E2eeKeyError);
    expect(() => parseKeyDirectory("null")).toThrow(E2eeKeyError);
  });
});

describe("fetchKeyFromUrl", () => {
  it("downloads and parses a key", async () => {
    const fetch = fetchImpl({
      "https://example.org/node-a.pub": `# Node A\n${publicKey}\n`,
    });
    const entry = await fetchKeyFromUrl("https://example.org/node-a.pub", {
      name: "Node A",
      fetchImpl: fetch,
    });
    expect(entry).toMatchObject({
      name: "Node A",
      publicKey,
      url: "https://example.org/node-a.pub",
      source: "url",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://example.org/node-a.pub",
      expect.objectContaining({
        headers: { Accept: "text/plain, application/json" },
      }),
    );
  });

  it("reports a failed download", async () => {
    await expect(
      fetchKeyFromUrl("https://example.org/gone.pub", {
        fetchImpl: fetchImpl({}),
      }),
    ).rejects.toThrow(/answered with 404/);
    await expect(
      fetchKeyFromUrl("https://example.org/down.pub", {
        fetchImpl: fetchImpl({
          "https://example.org/down.pub": new Error("offline"),
        }),
      }),
    ).rejects.toThrow(/Could not reach/);
  });
});

describe("fetchKeyDirectory", () => {
  it("resolves inline and relative-url keys and maps models", async () => {
    const fetch = fetchImpl({
      "https://example.org/keys/index.json": JSON.stringify({
        keys: [
          {
            id: "node-a",
            name: "Node A",
            publicKey,
            models: ["qwen-a"],
          },
          { id: "node-b", name: "Node B", url: "node-b.pub" },
        ],
        models: { "qwen-b": "Node B", "qwen-c": "node-c" },
      }),
      "https://example.org/keys/node-b.pub": otherPublicKey,
    });
    const result = await fetchKeyDirectory(
      "https://example.org/keys/index.json",
      { fetchImpl: fetch },
    );

    expect(result.keys).toHaveLength(2);
    expect(result.keys[0]).toMatchObject({ id: "node-a", publicKey });
    // A URL-only entry is fetched and named after the directory entry.
    expect(result.keys[1]).toMatchObject({
      name: "Node B",
      publicKey: otherPublicKey,
      source: "url",
      url: "https://example.org/keys/node-b.pub",
    });
    expect(result.models).toEqual({
      "qwen-a": result.keys[0].id,
      "qwen-b": result.keys[1].id,
      // An unknown reference is kept verbatim; resolution then fails closed.
      "qwen-c": "node-c",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://example.org/keys/node-b.pub",
      expect.anything(),
    );
  });

  it("keeps a directory id instead of deriving one", async () => {
    const result = await fetchKeyDirectory("https://example.org/keys.json", {
      fetchImpl: fetchImpl({
        "https://example.org/keys.json": JSON.stringify({
          keys: [{ id: "published-id", name: "A", publicKey }],
          models: { "qwen-a": "published-id" },
        }),
      }),
    });
    expect(result.keys[0].id).toBe("published-id");
    expect(result.models["qwen-a"]).toBe("published-id");
  });

  it("rejects an entry with neither a key nor a URL", async () => {
    await expect(
      fetchKeyDirectory("https://example.org/keys.json", {
        fetchImpl: fetchImpl({
          "https://example.org/keys.json": JSON.stringify({
            keys: [{ id: "broken", name: "Broken" }],
          }),
        }),
      }),
    ).rejects.toThrow(/carries neither a key nor a URL/);
  });
});

describe("publicKeyFileText", () => {
  it("writes a comment and the key", () => {
    expect(publicKeyFileText({ name: "Node A", publicKey })).toBe(
      `# Node A\n${publicKey}\n`,
    );
    expect(publicKeyFileText({ publicKey })).toBe(`${publicKey}\n`);
  });
});

describe("mergeKeyImport", () => {
  it("keeps known keys, updates by id and appends new ones", () => {
    const existing = [
      { id: "node-a", name: "Old", publicKey },
      { id: "gone", publicKey: otherPublicKey },
    ];
    const merged = mergeKeyImport(existing, [
      { id: "node-a", name: "New", publicKey, source: "directory" },
      { id: "node-b", name: "Node B", publicKey: otherPublicKey },
    ]);
    expect(merged.map((key) => key.id)).toEqual(["node-a", "gone", "node-b"]);
    expect(merged[0]).toMatchObject({ name: "New", source: "directory" });
  });

  it("ignores unusable existing entries", () => {
    expect(
      mergeKeyImport([{ id: "", publicKey }], [{ id: "node-a", publicKey }]),
    ).toHaveLength(1);
    expect(mergeKeyImport(undefined, [])).toEqual([]);
  });
});
