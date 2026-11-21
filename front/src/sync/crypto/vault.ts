import { gcm } from "@noble/ciphers/aes.js";
import { argon2idAsync } from "@noble/hashes/argon2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { fromBase64Url, random, toBase64Url, toBytes } from "./bytes";

/**
 * The vault key lives inside the encrypted header, and the passphrase only
 * wraps it. A passphrase change therefore rewraps 32 bytes instead of
 * re-encrypting the archive, and every record is sealed with a key that never
 * changes for the lifetime of the vault.
 *
 * The same reasoning as `src/e2ee/protocol.js`: AES-256-GCM with a fresh
 * 96-bit IV and an AAD that names the slot, so a blob cannot be replayed
 * somewhere else.
 */

export type ArgonParams = {
  alg: "argon2id";
  t: number;
  m: number;
  p: number;
  dkLen: number;
  salt: string;
};

export type VaultHeader = {
  v: 1;
  vaultId: string;
  kdf: ArgonParams;
  wrapped: { iv: string; ct: string };
  createdAt: number;
};

export type VaultKeys = {
  vaultKey: Uint8Array;
  blobKey: Uint8Array;
  assetKey: Uint8Array;
};

/**
 * 64 MiB / 3 passes is roughly half a second on a mid-range laptop and keeps a
 * stolen `vault.json` expensive to attack. Stored in the header, so older
 * parameters keep working after a change.
 */
export const DEFAULT_ARGON: Omit<ArgonParams, "salt"> = {
  alg: "argon2id",
  t: 3,
  m: 65536,
  p: 1,
  dkLen: 32,
};

export const MIN_PASSPHRASE_LENGTH = 10;

const DOMAIN = toBytes("chatai-sync/v1");
const HKDF_SALT = sha256(DOMAIN);

export class VaultError extends Error {
  readonly code:
    | "PASSPHRASE_REQUIRED"
    | "PASSPHRASE_TOO_SHORT"
    | "WRONG_PASSPHRASE"
    | "INVALID_VAULT";

  constructor(code: VaultError["code"], message: string) {
    super(message);
    this.name = "VaultError";
    this.code = code;
  }
}

const wrapAad = (vaultId: string) => toBytes(`chatai-sync/v1/vault/${vaultId}`);

const deriveKek = async (
  passphrase: string,
  salt: Uint8Array,
  params: ArgonParams,
): Promise<Uint8Array> => {
  const kek = await argon2idAsync(toBytes(passphrase), salt, {
    t: params.t,
    m: params.m,
    p: params.p,
    dkLen: params.dkLen,
  });
  return hkdf(sha256, kek, HKDF_SALT, toBytes("wrap"), 32);
};

const derivePurposeKeys = (vaultKey: Uint8Array): VaultKeys => ({
  vaultKey,
  blobKey: hkdf(sha256, vaultKey, HKDF_SALT, toBytes("blob"), 32),
  assetKey: hkdf(sha256, vaultKey, HKDF_SALT, toBytes("asset"), 32),
});

const sealWrap = (kek: Uint8Array, vaultKey: Uint8Array, vaultId: string) => {
  const iv = random(12);
  const ct = gcm(kek, iv, wrapAad(vaultId)).encrypt(vaultKey);
  return { iv: toBase64Url(iv), ct: toBase64Url(ct) };
};

const openWrap = (
  kek: Uint8Array,
  wrapped: { iv: string; ct: string },
  vaultId: string,
): Uint8Array => {
  try {
    return gcm(
      kek,
      fromBase64Url(wrapped.iv),
      wrapAad(vaultId),
    ).decrypt(fromBase64Url(wrapped.ct));
  } catch {
    // AES-GCM cannot tell a wrong key from a damaged blob, and neither can we.
    throw new VaultError(
      "WRONG_PASSPHRASE",
      "This passphrase does not open this vault.",
    );
  }
};

export const assertPassphrase = (passphrase: string) => {
  if (typeof passphrase !== "string" || !passphrase) {
    throw new VaultError("PASSPHRASE_REQUIRED", "A passphrase is required.");
  }
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new VaultError(
      "PASSPHRASE_TOO_SHORT",
      `The passphrase needs at least ${MIN_PASSPHRASE_LENGTH} characters.`,
    );
  }
};

export function isValidHeader(value: any): value is VaultHeader {
  return Boolean(
    value &&
      value.v === 1 &&
      typeof value.vaultId === "string" &&
      value.kdf?.alg === "argon2id" &&
      typeof value.kdf.salt === "string" &&
      Number.isFinite(value.kdf.m) &&
      Number.isFinite(value.kdf.t) &&
      value.wrapped?.iv &&
      value.wrapped?.ct,
  );
}

/** Create a fresh vault. The caller stores `header` and keeps `keys` in memory. */
export async function createVault(
  passphrase: string,
  options: { argon?: Partial<Omit<ArgonParams, "salt">> } = {},
): Promise<{ header: VaultHeader; keys: VaultKeys }> {
  assertPassphrase(passphrase);
  const params: ArgonParams = {
    ...DEFAULT_ARGON,
    ...options.argon,
    alg: "argon2id",
    salt: toBase64Url(random(16)),
  };
  const salt = fromBase64Url(params.salt);
  const kek = await deriveKek(passphrase, salt, params);
  const vaultKey = random(32);
  const vaultId = toBase64Url(random(12));
  const header: VaultHeader = {
    v: 1,
    vaultId,
    kdf: params,
    wrapped: sealWrap(kek, vaultKey, vaultId),
    createdAt: Date.now(),
  };
  return { header, keys: derivePurposeKeys(vaultKey) };
}

/** Derive the KEK and unwrap the vault key from a stored header. */
export async function unlockVault(
  header: VaultHeader,
  passphrase: string,
): Promise<VaultKeys> {
  if (!isValidHeader(header)) {
    throw new VaultError("INVALID_VAULT", "This is not a Chat AI sync vault.");
  }
  assertPassphrase(passphrase);
  const kek = await deriveKek(
    passphrase,
    fromBase64Url(header.kdf.salt),
    header.kdf,
  );
  return derivePurposeKeys(openWrap(kek, header.wrapped, header.vaultId));
}

/** Re-wrap the same vault key under a new passphrase (and a fresh salt). */
export async function changePassphrase(
  header: VaultHeader,
  keys: VaultKeys,
  nextPassphrase: string,
): Promise<{ header: VaultHeader; keys: VaultKeys }> {
  assertPassphrase(nextPassphrase);
  const params: ArgonParams = {
    ...header.kdf,
    salt: toBase64Url(random(16)),
  };
  const kek = await deriveKek(
    nextPassphrase,
    fromBase64Url(params.salt),
    params,
  );
  return {
    header: {
      ...header,
      kdf: params,
      wrapped: sealWrap(kek, keys.vaultKey, header.vaultId),
    },
    keys,
  };
}

/** The passphrase bytes are not retained anywhere; only the derived keys are. */
export const vaultFingerprint = (keys: VaultKeys): string =>
  toBase64Url(sha256(keys.vaultKey).subarray(0, 8));
