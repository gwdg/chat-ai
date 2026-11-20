import { beforeEach, describe, expect, it } from "vitest";

import {
  BRIDGE_KEYS_STORAGE,
  bridgeKeyFor,
  bridgeKeyScope,
  clearBridgeKeys,
  randomBridgeKey,
} from "../bridgeKey";

beforeEach(() => {
  window.localStorage.clear();
});

describe("the per-chat bridge key", () => {
  it("is 32 random bytes in the URL- and header-safe alphabet", () => {
    const key = randomBridgeKey();

    // 32 bytes base64url-encoded without padding. `back` compares this value as an HTTP
    // header, so an alphabet with `+`, `/` or `=` would have to be quoted or mangled.
    expect(key).toHaveLength(43);
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(key).not.toBe(randomBridgeKey());
  });

  it("keeps one key per chat and returns it again", () => {
    const scope = bridgeKeyScope("agent-1", "ses_alpha");

    const first = bridgeKeyFor(scope);
    expect(bridgeKeyFor(scope)).toBe(first);
    // A different chat is a different key: that is what makes it per chat rather than per
    // deployment.
    expect(bridgeKeyFor(bridgeKeyScope("agent-1", "ses_beta"))).not.toBe(first);
    expect(bridgeKeyFor(bridgeKeyScope("agent-2", "ses_alpha"))).not.toBe(first);
  });

  it("survives a reload through localStorage", () => {
    const scope = bridgeKeyScope("agent-1", "ses_alpha");
    const key = bridgeKeyFor(scope);

    const stored = JSON.parse(window.localStorage.getItem(BRIDGE_KEYS_STORAGE) || "{}");
    expect(stored[scope]).toBe(key);
    // The page reads the map on every call, so a second mount finds the same value without
    // any in-memory cache.
    expect(bridgeKeyFor(scope)).toBe(key);
  });

  it("scopes an agent without a session separately from the default one", () => {
    expect(bridgeKeyScope("agent-1", "")).toBe("agent-1:default");
    expect(bridgeKeyScope("agent-1", "ses_alpha")).toBe("agent-1:ses_alpha");
    // Nothing to key against: no stored entry may be created for an empty agent id.
    expect(bridgeKeyScope("", "ses_alpha")).toBe("");
  });

  it("keeps the map bounded and drops the oldest chat", () => {
    for (let index = 0; index < 205; index += 1) {
      bridgeKeyFor(`agent:${index}`);
    }

    const stored = JSON.parse(window.localStorage.getItem(BRIDGE_KEYS_STORAGE) || "{}");
    expect(Object.keys(stored)).toHaveLength(200);
    // Insertion order is the eviction order, so the first five are gone and the last is kept.
    expect(stored["agent:0"]).toBeUndefined();
    expect(stored["agent:204"]).toBeTruthy();
  });

  it("generates without storing when there is no scope", () => {
    const key = bridgeKeyFor("");

    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(window.localStorage.getItem(BRIDGE_KEYS_STORAGE)).toBeNull();
  });

  it("treats unparseable storage as empty instead of throwing", () => {
    window.localStorage.setItem(BRIDGE_KEYS_STORAGE, "not json");

    expect(() => bridgeKeyFor("agent:1")).not.toThrow();
    expect(bridgeKeyFor("agent:1")).toBe(bridgeKeyFor("agent:1"));
  });

  it("forgets every key on request", () => {
    bridgeKeyFor("agent:1");
    clearBridgeKeys();

    expect(window.localStorage.getItem(BRIDGE_KEYS_STORAGE)).toBeNull();
  });
});
