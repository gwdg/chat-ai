import { describe, expect, it } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";

import { E2eeKeyError, b64e, keyId } from "../protocol";
import {
  findKeyForAssignment,
  isModelKeyed,
  normalizeE2eeKeys,
  normalizeE2eeModels,
  resolveModelKey,
  usableKey,
} from "../registry";

const privateKey = x25519.utils.randomSecretKey();
const publicKey = b64e(x25519.getPublicKey(privateKey));
const otherKey = b64e(x25519.getPublicKey(x25519.utils.randomSecretKey()));

const validKey = { id: "node-a", name: "Node A", publicKey };

describe("normalizeE2ee*", () => {
  it("keeps only usable key entries", () => {
    expect(
      normalizeE2eeKeys([
        validKey,
        null,
        { id: "", publicKey },
        { id: "empty", publicKey: "  " },
      ]),
    ).toEqual([validKey]);
    expect(normalizeE2eeKeys(undefined)).toEqual([]);
  });

  it("keeps only string assignments", () => {
    expect(
      normalizeE2eeModels({
        "qwen-a": "node-a",
        "qwen-b": 7,
        "": "node-a",
        "qwen-c": "",
      }),
    ).toEqual({ "qwen-a": "node-a" });
    expect(normalizeE2eeModels([])).toEqual({});
  });
});

describe("usableKey", () => {
  it("parses the key and derives its fingerprint", () => {
    const usable = usableKey(validKey);
    expect(usable.kid).toBe(keyId(x25519.getPublicKey(privateKey)));
    expect(usable.publicKeyBytes).toHaveLength(32);
  });

  it("returns null for a malformed key", () => {
    expect(usableKey({ id: "x", publicKey: "nope" })).toBeNull();
    expect(usableKey(null)).toBeNull();
  });
});

describe("isModelKeyed", () => {
  const state = { keys: [validKey], models: { "qwen-a": "node-a" } };

  it("is true only for a model bound to a usable key", () => {
    expect(isModelKeyed(state, "qwen-a")).toBe(true);
    expect(isModelKeyed(state, "qwen-b")).toBe(false);
    expect(isModelKeyed({ keys: [], models: state.models }, "qwen-a")).toBe(false);
    expect(
      isModelKeyed(
        { keys: [{ ...validKey, publicKey: "nope" }], models: state.models },
        "qwen-a",
      ),
    ).toBe(false);
  });

  it("resolves an assignment by key id or fingerprint", () => {
    const kid = keyId(x25519.getPublicKey(privateKey));
    expect(findKeyForAssignment([validKey], "node-a")).toBe(validKey);
    expect(findKeyForAssignment([validKey], kid)).toBe(validKey);
    expect(findKeyForAssignment([validKey], "missing")).toBeNull();
  });
});

describe("resolveModelKey", () => {
  it("returns null for an unkeyed model", () => {
    expect(resolveModelKey({ keys: [validKey], models: {} }, "qwen-a")).toBeNull();
  });

  it("returns the key material for a keyed model", () => {
    const resolved = resolveModelKey(
      { keys: [validKey], models: { "qwen-a": "node-a" } },
      "qwen-a",
    );
    expect(resolved.kid).toBe(keyId(x25519.getPublicKey(privateKey)));
    expect(b64e(resolved.nodePublic)).toBe(publicKey);
  });

  // Fail closed: a keyed model never degrades to cleartext.
  it("throws when the assigned key is missing", () => {
    expect(() =>
      resolveModelKey({ keys: [validKey], models: { "qwen-a": "gone" } }, "qwen-a"),
    ).toThrow(E2eeKeyError);
  });

  it("throws when the assigned key is not a 32-byte X25519 key", () => {
    expect(() =>
      resolveModelKey(
        {
          keys: [{ id: "broken", publicKey: otherKey.slice(0, 10) }],
          models: { "qwen-a": "broken" },
        },
        "qwen-a",
      ),
    ).toThrow(/not a valid 32-byte X25519 public key/);
  });
});
