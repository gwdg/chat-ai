import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { equalBytes, fromBase64Url, random, toBase64Url, toBytes } from "./crypto/bytes";
import { openBlob, sealBlob } from "./crypto/envelope";
import type { VaultKeys } from "./crypto/vault";

/**
 * A passkey can hold the vault key for this device.
 *
 * WebAuthn's PRF extension turns a credential into a stable 32-byte secret: the
 * authenticator derives it from its own internal key and the salt the page
 * supplies, and no part of it is ever stored. That secret becomes the key that
 * wraps `VaultKeys`, so remembering the vault survives a reload without writing
 * the passphrase or an unwrapped key anywhere.
 *
 * Only the wrapped key and the credential metadata are persisted (in `sync_meta`
 * by the service). The binding is device-local on purpose: it must never enter
 * the sync archive or a backup, because the other device could not use it.
 */

/** A revision bump here is a new AAD/derivation, not a migration in place. */
const BINDING_VERSION = 1;
const WRAP_INFO = toBytes("chatai-sync/v1/passkey/wrap");
const KEY_BYTES = 32;
const PACKED_BYTES = KEY_BYTES * 3;

export type PasskeyBinding = {
  v: 1;
  /** Base64url `PublicKeyCredential.rawId`. */
  credentialId: string;
  /** Base64url PRF input; also the HKDF salt. */
  salt: string;
  /** Base64url `CASSYNC1` envelope around the three vault keys. */
  wrapped: string;
  /** The vault this binding belongs to; a rotated vault discards it. */
  vaultId: string;
  label: string;
  createdAt: number;
};

export class PasskeyError extends Error {
  readonly code: "UNSUPPORTED" | "CANCELLED" | "FAILED" | "MISMATCH";

  constructor(code: PasskeyError["code"], message: string) {
    super(message);
    this.name = "PasskeyError";
    this.code = code;
  }
}

const passkeyAad = (vaultId: string) => `chatai-sync/v1/passkey/${vaultId}`;

/** PRF output → wrapping key. The salt is the PRF input as well. */
const deriveKek = (secret: Uint8Array, salt: Uint8Array): Uint8Array =>
  hkdf(sha256, secret, salt, WRAP_INFO, KEY_BYTES);

const packKeys = (keys: VaultKeys): Uint8Array => {
  const out = new Uint8Array(PACKED_BYTES);
  out.set(keys.vaultKey, 0);
  out.set(keys.blobKey, KEY_BYTES);
  out.set(keys.assetKey, KEY_BYTES * 2);
  return out;
};

const unpackKeys = (packed: Uint8Array): VaultKeys => {
  if (packed.length !== PACKED_BYTES) {
    throw new PasskeyError("FAILED", "The passkey did not return a vault key.");
  }
  return {
    vaultKey: packed.slice(0, KEY_BYTES),
    blobKey: packed.slice(KEY_BYTES, KEY_BYTES * 2),
    assetKey: packed.slice(KEY_BYTES * 2),
  };
};

/** True when this browser exposes the WebAuthn entry points we need. */
export function isPasskeySupported(): boolean {
  return Boolean(
    typeof navigator !== "undefined" &&
      typeof (navigator as any).credentials?.create === "function" &&
      typeof (navigator as any).credentials?.get === "function" &&
      typeof window !== "undefined" &&
      // WebAuthn only exists in a secure context (HTTPS or localhost), so an
      // insecure LAN address must not offer a button that can only fail.
      (window as any).isSecureContext !== false &&
      typeof (window as any).PublicKeyCredential === "function",
  );
}

export function isPasskeyBinding(value: any): value is PasskeyBinding {
  return Boolean(
    value &&
      value.v === BINDING_VERSION &&
      typeof value.credentialId === "string" &&
      value.credentialId &&
      typeof value.salt === "string" &&
      typeof value.wrapped === "string" &&
      typeof value.vaultId === "string" &&
      typeof value.label === "string",
  );
}

const prfOutput = (credential: any): Uint8Array | null => {
  const first = credential?.getClientExtensionResults?.()?.prf?.results?.first;
  if (!first) return null;
  if (first instanceof Uint8Array) return first;
  if (first instanceof ArrayBuffer) return new Uint8Array(first);
  return new Uint8Array(first.buffer ?? first);
};

const userCancelled = (error: unknown) =>
  error instanceof DOMException
    ? error.name === "NotAllowedError" || error.name === "AbortError"
    : (error as any)?.name === "NotAllowedError" || (error as any)?.name === "AbortError";

const asPasskeyError = (error: unknown, fallback: string): PasskeyError => {
  if (error instanceof PasskeyError) return error;
  if (userCancelled(error)) {
    return new PasskeyError("CANCELLED", "The passkey prompt was dismissed.");
  }
  const message = error instanceof Error && error.message ? error.message : fallback;
  return new PasskeyError("FAILED", message);
};

const requireSupport = () => {
  if (!isPasskeySupported()) {
    throw new PasskeyError(
      "UNSUPPORTED",
      "This browser does not support passkeys. Use the passphrase instead.",
    );
  }
};

/**
 * Ask an authenticator for the PRF secret belonging to `credentialId`.
 * Requires user verification and may need transient user activation, so the UI
 * must call it from an explicit click (or treat an automatic attempt as
 * best-effort).
 */
export async function assertPasskeyPrf(
  credentialId: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  requireSupport();
  let credential: any;
  try {
    credential = await (navigator as any).credentials.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [
          { type: "public-key", id: fromBase64Url(credentialId) },
        ],
        userVerification: "required",
        timeout: 60_000,
        extensions: { prf: { eval: { first: salt } } },
      },
    });
  } catch (error) {
    throw asPasskeyError(error, "The passkey could not be used.");
  }
  if (!credential) {
    throw new PasskeyError("CANCELLED", "No passkey was selected.");
  }
  const secret = prfOutput(credential);
  if (!secret) {
    throw new PasskeyError(
      "UNSUPPORTED",
      "This passkey cannot produce the secret that opens the vault.",
    );
  }
  return secret;
}

const createCredential = async (
  label: string,
  salt: Uint8Array,
): Promise<{ credentialId: string; secret: Uint8Array }> => {
  requireSupport();
  const challenge = random(32);
  let credential: any;
  try {
    credential = await (navigator as any).credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Chat AI" },
        user: {
          id: random(32),
          name: `chat-ai-sync-${toBase64Url(random(6))}`,
          displayName: label || "Chat AI sync vault",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
        timeout: 60_000,
        attestation: "none",
        extensions: { prf: { eval: { first: salt } } },
      },
    });
  } catch (error) {
    throw asPasskeyError(error, "The passkey could not be created.");
  }
  if (!credential) {
    throw new PasskeyError("CANCELLED", "No passkey was created.");
  }
  const credentialId = toBase64Url(new Uint8Array(credential.rawId));
  // Most authenticators only report `prf.enabled` at creation, so the first
  // assertion is what actually yields the secret.
  const secret = prfOutput(credential) ?? (await assertPasskeyPrf(credentialId, salt));
  return { credentialId, secret };
};

/** Enrol a passkey for an unlocked vault and return the device-local binding. */
export async function createPasskeyBinding(
  keys: VaultKeys,
  vaultId: string,
  label: string,
): Promise<PasskeyBinding> {
  if (!vaultId) {
    throw new PasskeyError("MISMATCH", "There is no vault to protect yet.");
  }
  const salt = random(KEY_BYTES);
  const { credentialId, secret } = await createCredential(label, salt);
  const wrapped = await sealBlob(
    deriveKek(secret, salt),
    passkeyAad(vaultId),
    packKeys(keys),
  );
  return {
    v: BINDING_VERSION,
    credentialId,
    salt: toBase64Url(salt),
    wrapped: toBase64Url(wrapped),
    vaultId,
    label,
    createdAt: Date.now(),
  };
}

/** Ask the passkey for the secret and unwrap the vault keys. */
export async function unwrapVaultKeysWithPasskey(
  binding: PasskeyBinding,
  vaultId: string,
): Promise<VaultKeys> {
  if (!isPasskeyBinding(binding)) {
    throw new PasskeyError("MISMATCH", "The stored passkey binding is not readable.");
  }
  if (binding.vaultId !== vaultId) {
    throw new PasskeyError("MISMATCH", "This passkey belongs to a different vault.");
  }
  const salt = fromBase64Url(binding.salt);
  const secret = await assertPasskeyPrf(binding.credentialId, salt);
  let packed: Uint8Array;
  try {
    packed = await openBlob(
      deriveKek(secret, salt),
      passkeyAad(binding.vaultId),
      fromBase64Url(binding.wrapped),
    );
  } catch {
    throw new PasskeyError("FAILED", "This passkey no longer opens the vault.");
  }
  return unpackKeys(packed);
}

/** Round-trip helper used by the tests and by the "same key?" guard. */
export const passkeyKeysMatch = (left: VaultKeys, right: VaultKeys): boolean =>
  equalBytes(left.vaultKey, right.vaultKey) &&
  equalBytes(left.blobKey, right.blobKey) &&
  equalBytes(left.assetKey, right.assetKey);
