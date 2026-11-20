import { describe, expect, it, vi } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";

import {
  E2eeKeyError,
  ResponseSealer,
  b64e,
  openRequest,
  randomBytes,
} from "../protocol";
import { verifyKeyForModel } from "../verify";

const nodePrivate = x25519.utils.randomSecretKey();
const nodePublic = x25519.getPublicKey(nodePrivate);
const key = { id: "key-1", publicKey: b64e(nodePublic) };
const modelId = "e2ee-demo";
const url = "http://localhost:10000/public/v1/chat/completions";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** A node that opens the request with `nodePrivate` and seals its answer. */
const sealedFetch = (makeResponse = () => ({ id: "x", choices: [] })) =>
  vi.fn(async (target, init) => {
    const raw = JSON.parse(init.body);
    const hint = raw.stream;
    delete raw.stream;
    // The wire body still carries the cleartext routing hint.
    expect(hint).toBe(false);
    const opened = openRequest({
      body: raw,
      path: new URL(target).pathname,
      nodePrivate,
    });
    const sealer = new ResponseSealer(opened.responseKey);
    return json({
      ...sealer.seal(JSON.stringify(makeResponse())),
    });
  });

describe("verifyKeyForModel", () => {
  it("seals a minimal request and accepts a sealed answer", async () => {
    const fetchImpl = sealedFetch();
    await expect(
      verifyKeyForModel({ modelId, key, url, fetchImpl }),
    ).resolves.toEqual({ ok: true, modelId });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0];
    const sent = JSON.parse(init.body);
    expect(Object.keys(sent).sort()).toEqual(["e2ee", "model", "stream"]);
    expect(sent.model).toBe(modelId);
    expect(sent.stream).toBe(false);
    // Nothing readable leaves the browser, not even the test prompt.
    expect(init.body).not.toContain("ping");
  });

  it("forwards caller headers so a direct engine can authenticate", async () => {
    const fetchImpl = sealedFetch();
    await verifyKeyForModel({
      modelId,
      key,
      url,
      fetchImpl,
      headers: { Authorization: "Bearer test" },
    });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer test");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("reports an unknown key from the node", async () => {
    const fetchImpl = vi.fn(async () =>
      json(
        {
          error: {
            message: "Unknown key id",
            type: "invalid_request_error",
            code: "e2ee_unknown_key",
          },
        },
        400,
      ),
    );

    await expect(
      verifyKeyForModel({ modelId, key, url, fetchImpl }),
    ).rejects.toMatchObject({
      name: "E2eeVerifyError",
      reason: "unknown_key",
      modelId,
      status: 400,
      code: "e2ee_unknown_key",
    });
  });

  it("rejects a node that answers in cleartext", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ id: "x", choices: [{ message: { content: "hi" } }] }),
    );

    await expect(
      verifyKeyForModel({ modelId, key, url, fetchImpl }),
    ).rejects.toMatchObject({ reason: "not_encrypted", modelId });
  });

  it("rejects an answer that does not open with the session key", async () => {
    const fetchImpl = sealedFetchWithKey(() => randomBytes(32));

    await expect(
      verifyKeyForModel({ modelId, key, url, fetchImpl }),
    ).rejects.toMatchObject({ reason: "decrypt_failed", modelId });
  });

  it("reports an unreachable endpoint", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    await expect(
      verifyKeyForModel({ modelId, key, url, fetchImpl }),
    ).rejects.toMatchObject({ reason: "network", modelId });
  });

  it("reports a timeout", async () => {
    const fetchImpl = vi.fn(
      (target, init) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );

    await expect(
      verifyKeyForModel({ modelId, key, url, fetchImpl, timeoutMs: 5 }),
    ).rejects.toMatchObject({ reason: "timeout", modelId });
  });

  it("refuses to send with an unparsable key", async () => {
    const fetchImpl = vi.fn();

    await expect(
      verifyKeyForModel({
        modelId,
        key: { id: "bad", publicKey: "not-a-key" },
        url,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(E2eeKeyError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

/** Seals the answer with a key of its own, as a node with the wrong key would. */
function sealedFetchWithKey(responseKeyFor) {
  return vi.fn(async (target, init) => {
    const raw = JSON.parse(init.body);
    delete raw.stream;
    const opened = openRequest({
      body: raw,
      path: new URL(target).pathname,
      nodePrivate,
    });
    const sealer = new ResponseSealer(responseKeyFor(opened));
    return json({ ...sealer.seal("{}") });
  });
}
