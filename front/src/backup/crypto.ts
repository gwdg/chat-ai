import { argon2idAsync } from "@noble/hashes/argon2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

import {
  fromBase64Url,
  random,
  toBase64Url,
  toBytes,
} from "../sync/crypto/bytes";
import { openBlob, sealBlob } from "../sync/crypto/envelope";
import { MIN_PASSPHRASE_LENGTH } from "../sync/crypto/vault";

/**
 * The container and key derivation of the encrypted backup package.
 *
 * This is deliberately separate from `src/sync/crypto/`: sync keeps a vault key
 * at rest in the user's SAIA filesystem and derives record/asset keys from it,
 * while a backup is a single self-contained file that is encrypted directly
 * under a passphrase. The two domains do not share a key, so a backup file can
 * never be replayed as a sync record and vice versa.
 *
 * The blob container itself is the audited `CASSYNC1` envelope (AES-256-GCM,
 * fresh IV, gzip), and its AAD names the backup's creation time, which binds the
 * ciphertext to the header a user sees.
 */

export type BackupKdf = {
  alg: "argon2id";
  t: number;
  m: number;
  p: number;
  dkLen: number;
  salt: string;
};

export type BackupContainer = {
  format: "chat-ai-backup";
  version: 1;
  /** Unix milliseconds; also the AAD of the sealed payload. */
  createdAt: number;
  appVersion?: string;
  counts?: Record<string, number>;
  kdf: BackupKdf;
  /** base64url of the sealed archive. */
  payload: string;
};

export const BACKUP_FORMAT = "chat-ai-backup";
export const BACKUP_VERSION = 1;
export const MIN_BACKUP_PASSPHRASE_LENGTH = MIN_PASSPHRASE_LENGTH;

/** Same cost as a sync vault, so a stolen file stays expensive to attack. */
export const DEFAULT_BACKUP_ARGON: Omit<BackupKdf, "salt"> = {
  alg: "argon2id",
  t: 3,
  m: 65536,
  p: 1,
  dkLen: 32,
};

/**
 * Bounds for values read from a file. A hostile header must not be able to make
 * the browser allocate gigabytes or spin for minutes before it fails.
 */
const MAX_ARGON_M = 1_048_576;
const MAX_ARGON_T = 10;
const MAX_ARGON_P = 4;

const DOMAIN = toBytes("chatai-backup/v1");
const HKDF_SALT = sha256(DOMAIN);

export class BackupError extends Error {
  readonly code:
    | "PASSPHRASE_REQUIRED"
    | "PASSPHRASE_TOO_SHORT"
    | "INVALID_BACKUP"
    | "UNSUPPORTED_VERSION"
    | "WRONG_PASSPHRASE";

  constructor(code: BackupError["code"], message: string) {
    super(message);
    this.name = "BackupError";
    this.code = code;
  }
}

export function assertBackupPassphrase(passphrase: string): void {
  if (typeof passphrase !== "string" || !passphrase) {
    throw new BackupError("PASSPHRASE_REQUIRED", "A passphrase is required.");
  }
  if (passphrase.length < MIN_BACKUP_PASSPHRASE_LENGTH) {
    throw new BackupError(
      "PASSPHRASE_TOO_SHORT",
      `The passphrase needs at least ${MIN_BACKUP_PASSPHRASE_LENGTH} characters.`,
    );
  }
}

const parseKdf = (value: any): BackupKdf => {
  if (
    !value ||
    value.alg !== "argon2id" ||
    typeof value.salt !== "string" ||
    !value.salt ||
    !Number.isFinite(value.t) ||
    !Number.isFinite(value.m) ||
    !Number.isFinite(value.p) ||
    value.dkLen !== 32
  ) {
    throw new BackupError("INVALID_BACKUP", "This backup has no usable key header.");
  }
  if (
    value.t < 1 ||
    value.t > MAX_ARGON_T ||
    value.m < 8 ||
    value.m > MAX_ARGON_M ||
    value.p < 1 ||
    value.p > MAX_ARGON_P
  ) {
    throw new BackupError("INVALID_BACKUP", "This backup uses unsupported key settings.");
  }
  return {
    alg: "argon2id",
    t: value.t,
    m: value.m,
    p: value.p,
    dkLen: 32,
    salt: value.salt,
  };
};

export function isValidBackupContainer(value: any): value is BackupContainer {
  return Boolean(
    value &&
      value.format === BACKUP_FORMAT &&
      value.version === BACKUP_VERSION &&
      Number.isFinite(value.createdAt) &&
      value.createdAt > 0 &&
      typeof value.payload === "string" &&
      value.payload.length > 0,
  );
}

/** Parse the cleartext container. It holds no key material. */
export function parseBackupContainer(text: string): BackupContainer {
  let value: any;
  try {
    value = JSON.parse(text);
  } catch {
    throw new BackupError("INVALID_BACKUP", "This file is not a Chat AI backup.");
  }
  if (!value || value.format !== BACKUP_FORMAT) {
    throw new BackupError("INVALID_BACKUP", "This file is not a Chat AI backup.");
  }
  if (value.version !== BACKUP_VERSION) {
    throw new BackupError(
      "UNSUPPORTED_VERSION",
      `This backup was written by a newer version (${String(value.version)}).`,
    );
  }
  if (!isValidBackupContainer(value)) {
    throw new BackupError("INVALID_BACKUP", "This backup is incomplete.");
  }
  return { ...value, kdf: parseKdf(value.kdf) };
}

const deriveBackupKey = async (
  passphrase: string,
  kdf: BackupKdf,
): Promise<Uint8Array> => {
  const kek = await argon2idAsync(toBytes(passphrase), fromBase64Url(kdf.salt), {
    t: kdf.t,
    m: kdf.m,
    p: kdf.p,
    dkLen: kdf.dkLen,
  });
  return hkdf(sha256, kek, HKDF_SALT, toBytes("backup"), 32);
};

const payloadAad = (createdAt: number) =>
  `chatai-backup/v1/${Math.trunc(createdAt)}`;

/** Derive a fresh salt and seal the archive under the passphrase. */
export async function sealBackupPayload(
  passphrase: string,
  createdAt: number,
  plaintext: Uint8Array,
  options: { argon?: Partial<Omit<BackupKdf, "salt">> } = {},
): Promise<{ kdf: BackupKdf; payload: string }> {
  assertBackupPassphrase(passphrase);
  const kdf: BackupKdf = {
    ...DEFAULT_BACKUP_ARGON,
    ...options.argon,
    alg: "argon2id",
    salt: toBase64Url(random(16)),
  };
  const key = await deriveBackupKey(passphrase, kdf);
  const sealed = await sealBlob(key, payloadAad(createdAt), plaintext);
  return { kdf, payload: toBase64Url(sealed) };
}

/** Open a parsed container and return the archive bytes. */
export async function openBackupPayload(
  passphrase: string,
  container: BackupContainer,
): Promise<Uint8Array> {
  assertBackupPassphrase(passphrase);
  const key = await deriveBackupKey(passphrase, container.kdf);
  try {
    return await openBlob(
      key,
      payloadAad(container.createdAt),
      fromBase64Url(container.payload),
    );
  } catch {
    // A wrong passphrase and a damaged/tampered payload are indistinguishable
    // here, and both mean the same thing to the user.
    throw new BackupError(
      "WRONG_PASSPHRASE",
      "The passphrase does not open this backup.",
    );
  }
}
