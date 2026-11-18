import { describe, expect, it } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";

import {
  E2eeDecryptError,
  E2eeKeyError,
  E2eeMalformedError,
  E2eeTruncatedError,
  ResponseDecryptor,
  ResponseSealer,
  b64d,
  b64e,
  canonicalJson,
  canonicalPath,
  keyId,
  openJsonResponse,
  openRequest,
  parsePublicKey,
  sealRequest,
  verifyFinal,
} from "../protocol";

const deterministicKey = new Uint8Array(32).map((_, index) => index);
const nodePrivate = x25519.utils.randomSecretKey();
const nodePublic = x25519.getPublicKey(nodePrivate);
const password = "A".repeat(43);

const payload = {
  messages: [
    { role: "system", content: "Be brief." },
    { role: "user", content: 'Hallo "Welt" äöü — 你好' },
  ],
  temperature: 0.5,
  tools: [{ type: "function", function: { name: "t", parameters: { type: "object" } } }],
  stream: true,
};

const sealed = (overrides = {}) =>
  sealRequest({
    model: "qwen-test",
    path: "/public/v1/chat/completions",
    payload,
    nodePublic,
    password,
    ...overrides,
  });

describe("encoding", () => {
  it("round-trips base64url without padding", () => {
    const encoded = b64e(deterministicKey);
    expect(encoded).toBe("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8");
    expect(Array.from(b64d(encoded))).toEqual(Array.from(deterministicKey));
    expect(encoded).not.toContain("=");
  });

  it("rejects non-base64 text", () => {
    expect(() => b64d(42)).toThrow(E2eeMalformedError);
    expect(() => b64d("!!!!")).toThrow(E2eeMalformedError);
  });

  // Known-answer tests against the Python reference implementation.
  it("serialises canonical JSON exactly like json.dumps(sort_keys=True, separators=(\",\", \":\"))", () => {
    expect(
      new TextDecoder().decode(
        canonicalJson({ b: 1, a: [1, "x"], c: null, d: { z: true, y: "ä" } }),
      ),
    ).toBe('{"a":[1,"x"],"b":1,"c":null,"d":{"y":"ä","z":true}}');
  });

  it("derives the key id from sha256(public key)[:12]", () => {
    expect(keyId(deterministicKey)).toBe("Yw3NKWbEM2aRElRI");
  });

  it("canonicalises every chat-completions endpoint to one AAD path", () => {
    expect(canonicalPath("/public/v1/chat/completions?x=1")).toBe("/v1/chat/completions");
    expect(canonicalPath("/v1/chat/completions")).toBe("/v1/chat/completions");
    expect(canonicalPath("/chat/completions")).toBe("/v1/chat/completions");
    expect(canonicalPath("/v1/completions")).toBe("/v1/completions");
    expect(canonicalPath("/documents/convert/file")).toBe("/documents/convert/file");
  });
});

describe("parsePublicKey", () => {
  it("accepts the published base64url form and whitespace", () => {
    expect(Array.from(parsePublicKey(` ${b64e(nodePublic)}\n`))).toEqual(
      Array.from(nodePublic),
    );
  });

  it("rejects empty, invalid and wrong-length keys", () => {
    expect(() => parsePublicKey("")).toThrow(E2eeKeyError);
    expect(() => parsePublicKey("not base64!")).toThrow(E2eeKeyError);
    expect(() => parsePublicKey(b64e(new Uint8Array(31)))).toThrow(E2eeKeyError);
  });

  it("rejects a key that is not canonical base64url", () => {
    // 32 bytes of 0xff encode to 43 underscores; the same bytes in the standard
    // alphabet (and any padding) must not be accepted as a published key.
    const canonical = b64e(new Uint8Array(32).fill(0xff));
    expect(Array.from(parsePublicKey(canonical))).toEqual(
      Array.from(new Uint8Array(32).fill(0xff)),
    );
    expect(() => parsePublicKey(canonical.replace(/_/g, "/"))).toThrow(
      /canonical base64url/,
    );
    expect(() => parsePublicKey(`${canonical}=`)).toThrow(/canonical base64url/);
  });
});

describe("sealRequest / openRequest", () => {
  it("encrypts everything except model and e2ee", () => {
    const { body, kid } = sealed();
    expect(Object.keys(body).sort()).toEqual(["e2ee", "model"]);
    expect(body.model).toBe("qwen-test");
    expect(body.e2ee.v).toBe(3);
    expect(body.e2ee.scheme).toBe("X25519-HKDF-SHA256+AES-256-GCM");
    expect(body.e2ee.kid).toBe(kid);
    expect(body.e2ee.kid).toBe(keyId(nodePublic));
    expect(JSON.stringify(body)).not.toContain("Hallo");
  });

  it("round-trips the payload and response key", () => {
    const session = sealed();
    const opened = openRequest({
      body: session.body,
      path: "/v1/chat/completions",
      nodePrivate,
    });
    expect(opened.model).toBe("qwen-test");
    expect(opened.payload).toEqual(payload);
    expect(b64e(opened.responseKey)).toBe(b64e(session.responseKey));
  });

  it("binds the request to the model, path and a reset-resistant nonce", () => {
    const session = sealed();
    expect(() =>
      openRequest({
        body: { ...session.body, model: "other-model" },
        path: "/v1/chat/completions",
        nodePrivate,
      }),
    ).toThrow(E2eeDecryptError);
    expect(() =>
      openRequest({
        body: { ...session.body, e2ee: { ...session.body.e2ee, kid: "wrong" } },
        path: "/v1/chat/completions",
        nodePrivate,
      }),
    ).toThrow(E2eeDecryptError);
    expect(() =>
      openRequest({
        body: session.body,
        path: "/v1/completions",
        nodePrivate,
      }),
    ).toThrow(E2eeDecryptError);
    const second = sealed();
    expect(second.body.e2ee.nonce).not.toBe(session.body.e2ee.nonce);
  });

  it("refuses cleartext fields beside the envelope", () => {
    const session = sealed();
    expect(() =>
      openRequest({
        body: { ...session.body, messages: [] },
        path: "/v1/chat/completions",
        nodePrivate,
      }),
    ).toThrow(/Unencrypted request field/);
  });

  it("refuses to seal a payload that repeats reserved fields", () => {
    expect(() => sealed({ payload: { model: "x" } })).toThrow(E2eeMalformedError);
    expect(() => sealed({ payload: { e2ee: {} } })).toThrow(E2eeMalformedError);
    expect(() => sealed({ model: "" })).toThrow(E2eeMalformedError);
    expect(() => sealed({ password: "" })).toThrow(E2eeKeyError);
  });
});

describe("response sealing", () => {
  const responseKey = new Uint8Array(32).fill(9);

  it("round-trips events and verifies the final marker", () => {
    const sealer = new ResponseSealer(responseKey);
    const decryptor = new ResponseDecryptor(responseKey);
    const first = sealer.event('{"choices":[{"delta":{"content":"hi"}}]}');
    const final = sealer.final();
    expect(decryptor.open(first.e2ee)).toBe('{"choices":[{"delta":{"content":"hi"}}]}');
    expect(decryptor.open(final.e2ee)).toBeNull();
    expect(decryptor.finalSeen).toBe(true);
    expect(() => verifyFinal(decryptor)).not.toThrow();
  });

  it("rejects out-of-order, replayed and tampered events", () => {
    const sealer = new ResponseSealer(responseKey);
    const decryptor = new ResponseDecryptor(responseKey);
    const first = sealer.event("one");
    const second = sealer.event("two");

    expect(() => decryptor.open(second.e2ee)).toThrow(/out of order/);
    expect(decryptor.open(first.e2ee)).toBe("one");
    expect(() => decryptor.open(first.e2ee)).toThrow(/out of order/);
    expect(() =>
      decryptor.open({ ...second.e2ee, ct: b64e(new Uint8Array(19)) }),
    ).toThrow(E2eeDecryptError);
  });

  it("rejects a truncated stream", () => {
    const sealer = new ResponseSealer(responseKey);
    const decryptor = new ResponseDecryptor(responseKey);
    decryptor.open(sealer.event("only").e2ee);
    expect(() => verifyFinal(decryptor)).toThrow(E2eeTruncatedError);
  });

  it("decrypts a non-streaming response and refuses a final marker in it", () => {
    const sealer = new ResponseSealer(responseKey);
    const envelope = sealer.seal(
      JSON.stringify({ choices: [{ message: { content: "answer" } }] }),
    );
    expect(openJsonResponse({ e2ee: envelope.e2ee }, responseKey)).toEqual({
      choices: [{ message: { content: "answer" } }],
    });
    expect(
      openJsonResponse({ id: "x", usage: { total_tokens: 1 } }, responseKey),
    ).toEqual({ id: "x", usage: { total_tokens: 1 } });
    const final = new ResponseSealer(responseKey).final();
    expect(() => openJsonResponse({ e2ee: final.e2ee }, responseKey)).toThrow(
      /final marker/,
    );
  });

  it("pads every frame to the block size", () => {
    const sealer = new ResponseSealer(responseKey, { padding: 64 });
    const envelope = sealer.event("x");
    const raw = b64d(envelope.e2ee.ct);
    // 16-byte GCM tag plus the padded plaintext (4-byte length prefix included).
    expect((raw.length - 16) % 64).toBe(0);
  });
});
