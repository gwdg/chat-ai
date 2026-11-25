import { describe, expect, it } from "vitest";

import { equalBytes, random, toBase64Url } from "../crypto/bytes";
import { openBlob, sealBlob, ENVELOPE_OVERHEAD_BYTES } from "../crypto/envelope";
import {
  assertPassphrase,
  changePassphrase,
  createVault,
  isValidHeader,
  MIN_PASSPHRASE_LENGTH,
  unlockVault,
  VaultError,
  vaultFingerprint,
} from "../crypto/vault";

/** Real Argon2id, cheap parameters: the derivation is what is under test, not its cost. */
const FAST_ARGON = { t: 1, m: 1024, p: 1 };
const PASSPHRASE = "correct horse battery staple";

const create = () => createVault(PASSPHRASE, { argon: FAST_ARGON });

describe("sync vault", () => {
  it("wraps one vault key and derives separate purpose keys", async () => {
    const { header, keys } = await create();
    expect(header.v).toBe(1);
    expect(header.vaultId).toBeTruthy();
    expect(header.wrapped.ct).toBeTruthy();
    expect(keys.vaultKey).toHaveLength(32);
    expect(keys.blobKey).toHaveLength(32);
    expect(keys.assetKey).toHaveLength(32);
    expect(equalBytes(keys.vaultKey, keys.blobKey)).toBe(false);
    expect(equalBytes(keys.blobKey, keys.assetKey)).toBe(false);
  });

  it("unlocks with the right passphrase and returns the same keys", async () => {
    const { header, keys } = await create();
    const unlocked = await unlockVault(header, PASSPHRASE);
    expect(equalBytes(unlocked.vaultKey, keys.vaultKey)).toBe(true);
    expect(equalBytes(unlocked.blobKey, keys.blobKey)).toBe(true);
    expect(equalBytes(unlocked.assetKey, keys.assetKey)).toBe(true);
    expect(vaultFingerprint(unlocked)).toBe(vaultFingerprint(keys));
  });

  it("rejects a wrong passphrase without writing anything", async () => {
    const { header } = await create();
    await expect(unlockVault(header, "not the passphrase")).rejects.toMatchObject(
      { name: "VaultError", code: "WRONG_PASSPHRASE" },
    );
  });

  it("requires a minimum passphrase length", async () => {
    await expect(createVault("short", { argon: FAST_ARGON })).rejects.toBeInstanceOf(
      VaultError,
    );
    expect(MIN_PASSPHRASE_LENGTH).toBeGreaterThan(0);
    expect(() => assertPassphrase("")).toThrow(/required/i);
  });

  it("re-wraps the same vault key under a new passphrase", async () => {
    const { header, keys } = await create();
    const next = "an entirely different secret";
    const rewrapped = await changePassphrase(header, keys, next);

    expect(rewrapped.header.vaultId).toBe(header.vaultId);
    expect(rewrapped.header.kdf.salt).not.toBe(header.kdf.salt);
    expect(rewrapped.header.wrapped.ct).not.toBe(header.wrapped.ct);
    expect(equalBytes(rewrapped.keys.vaultKey, keys.vaultKey)).toBe(true);

    const reopened = await unlockVault(rewrapped.header, next);
    expect(equalBytes(reopened.vaultKey, keys.vaultKey)).toBe(true);
    await expect(unlockVault(rewrapped.header, PASSPHRASE)).rejects.toMatchObject({
      code: "WRONG_PASSPHRASE",
    });
  });

  it("recognises only its own header format", async () => {
    const { header } = await create();
    expect(isValidHeader(header)).toBe(true);
    expect(isValidHeader({})).toBe(false);
    expect(isValidHeader({ ...header, v: 2 })).toBe(false);
    expect(isValidHeader({ ...header, wrapped: {} })).toBe(false);
    await expect(unlockVault({ nope: true }, PASSPHRASE)).rejects.toMatchObject({
      code: "INVALID_VAULT",
    });
  });

  it("keeps the salt and parameters in the header, not in the key", async () => {
    const { header } = await create();
    expect(header.kdf.alg).toBe("argon2id");
    expect(toBase64Url(new Uint8Array(0))).toBe("");
    expect(header.kdf.salt).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("sync blob envelope", () => {
  const key = random(32);

  it("round-trips bytes and reports its overhead", async () => {
    const plaintext = random(4096);
    const blob = await sealBlob(key, "slot/a", plaintext);
    expect(blob.byteLength).toBeGreaterThanOrEqual(plaintext.byteLength + ENVELOPE_OVERHEAD_BYTES);
    expect(new TextDecoder().decode(blob.subarray(0, 8))).toBe("CASSYNC1");

    const opened = await openBlob(key, "slot/a", blob);
    expect(equalBytes(opened, plaintext)).toBe(true);
  });

  it("binds a blob to its slot", async () => {
    const blob = await sealBlob(key, "slot/a", random(64));
    await expect(openBlob(key, "slot/b", blob)).rejects.toThrow(/decrypt/i);
  });

  it("rejects a wrong key and a truncated blob", async () => {
    const blob = await sealBlob(key, "slot/a", random(64));
    await expect(openBlob(random(32), "slot/a", blob)).rejects.toThrow(/decrypt/i);
    await expect(openBlob(key, "slot/a", blob.subarray(0, 12))).rejects.toThrow(
      /not a Chat AI sync blob/i,
    );
  });
});
