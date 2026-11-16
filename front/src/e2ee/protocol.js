// The SAIA E2EE v3 wire format, ported from saia/saia-e2ee's
// e2ee_connector/saia_e2ee/protocol.py.
//
// There is no key directory: the client learns a model node's static X25519
// public key out of band and encrypts to it. The request carries the client's
// random traffic password inside that encrypted outer layer, and the password
// keys the actual chat payload:
//
//     outer = X25519(client ephemeral, node static) -> password + inner envelope
//     inner = HKDF(password)                        -> the request body
//
// A request body is `{model, e2ee, stream?}`; everything else travels inside
// the envelope. Responses are sealed with the response key derived from the
// same password and shared secret, as JSON or as SSE events ending in an
// authenticated final marker.

import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { gcm } from "@noble/ciphers/aes.js";

export const VERSION = 3;
export const SCHEME = "X25519-HKDF-SHA256+AES-256-GCM";
/** The node rejects anything shorter; it is an entropy floor, not a policy. */
export const MIN_PASSWORD_BYTES = 32;
export const DEFAULT_PADDING = 256;

const AAD_PREFIX = "saia-e2ee-v3";
const FINAL = { saia_e2ee_final: true };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class E2eeError extends Error {
  constructor(message, code = "e2ee_error") {
    super(message);
    this.name = "E2eeError";
    this.code = code;
  }
}

export class E2eeMalformedError extends E2eeError {
  constructor(message) {
    super(message, "e2ee_malformed");
    this.name = "E2eeMalformedError";
  }
}

export class E2eeKeyError extends E2eeError {
  constructor(message) {
    super(message, "e2ee_key");
    this.name = "E2eeKeyError";
  }
}

export class E2eeDecryptError extends E2eeError {
  constructor(message) {
    super(message, "e2ee_decrypt_failed");
    this.name = "E2eeDecryptError";
  }
}

export class E2eeTruncatedError extends E2eeError {
  constructor(message) {
    super(message, "e2ee_truncated");
    this.name = "E2eeTruncatedError";
  }
}

export function b64e(value) {
  let binary = "";
  for (let i = 0; i < value.length; i += 0x8000) {
    binary += String.fromCharCode(...value.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64d(value) {
  if (typeof value !== "string") {
    throw new E2eeMalformedError("Expected base64url text");
  }
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  let binary;
  try {
    binary = atob(padded);
  } catch {
    throw new E2eeMalformedError("Invalid base64url text");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** `json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`. */
export function canonicalJson(value) {
  return encoder.encode(canonicalString(value));
}

function canonicalString(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalString(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalString(value[key])}`)
    .join(",")}}`;
}

export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** A 32-byte traffic password, base64url-encoded (43 bytes, above the floor). */
export function randomPassword() {
  return b64e(randomBytes(MIN_PASSWORD_BYTES));
}

export function keyId(publicKey) {
  return b64e(sha256(publicKey).subarray(0, 12));
}

/** Parses the published base64url form of a 32-byte X25519 public key. */
export function parsePublicKey(text) {
  const raw = String(text ?? "").trim();
  if (!raw) throw new E2eeKeyError("The public key is empty.");
  let bytes;
  try {
    bytes = b64d(raw.replace(/\s+/g, ""));
  } catch {
    throw new E2eeKeyError("The public key is not valid base64url text.");
  }
  if (bytes.length !== 32) {
    throw new E2eeKeyError(
      `An X25519 public key is 32 bytes, got ${bytes.length}.`,
    );
  }
  return bytes;
}

function pad(payload, block = DEFAULT_PADDING) {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, payload.length, false);
  if (!block || block <= 0) {
    return concat(length, payload);
  }
  let total = 4 + payload.length;
  total = Math.ceil(total / block) * block;
  return concat(length, payload, randomBytes(total - 4 - payload.length));
}

function unpad(padded) {
  if (padded.length < 4) {
    throw new E2eeDecryptError("Decrypted payload is too short");
  }
  const length = new DataView(
    padded.buffer,
    padded.byteOffset,
    padded.byteLength,
  ).getUint32(0, false);
  if (length > padded.length - 4) {
    throw new E2eeDecryptError("Decrypted payload has an invalid length prefix");
  }
  return padded.subarray(4, 4 + length);
}

function concat(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function outerKey(shared, epk, nodePublic) {
  const salt = concat(
    encoder.encode(`${AAD_PREFIX}|`),
    epk,
    encoder.encode("|"),
    nodePublic,
  );
  return hkdf(sha256, shared, salt, encoder.encode("outer"), 32);
}

function innerKey(password, nonce, shared, direction) {
  const salt = concat(
    encoder.encode(`${AAD_PREFIX}|`),
    nonce,
    encoder.encode("|"),
    shared,
  );
  return hkdf(sha256, password, salt, encoder.encode(direction), 32);
}

/** The endpoint identity bound into a request's AAD. */
export function canonicalPath(path) {
  const clean = String(path ?? "").split("?", 1)[0];
  if (clean.endsWith("/chat/completions")) return "/v1/chat/completions";
  if (clean.endsWith("/completions")) return "/v1/completions";
  return clean;
}

function outerAad(kid, model, path, nonce) {
  return canonicalJson({
    v: VERSION,
    dir: "outer",
    kid,
    model,
    path: canonicalPath(path),
    nonce: b64e(nonce),
  });
}

function innerAad(path, nonce) {
  return canonicalJson({
    v: VERSION,
    dir: "inner",
    path: canonicalPath(path),
    nonce: b64e(nonce),
  });
}

function responseAad(seq) {
  return canonicalJson({ v: VERSION, dir: "response", seq });
}

const aesGcm = (key, iv, aad) => gcm(key, iv, aad ?? new Uint8Array(0));

/**
 * Encrypts everything except `model` into a v3 request envelope.
 *
 * @returns {{body: object, responseKey: Uint8Array, nonce: Uint8Array, kid: string}}
 */
export function sealRequest({
  model,
  path,
  payload,
  nodePublic,
  password,
  padding = DEFAULT_PADDING,
}) {
  if (typeof model !== "string" || !model) {
    throw new E2eeMalformedError("Missing model");
  }
  if (payload && ("model" in payload || "e2ee" in payload)) {
    throw new E2eeMalformedError("Payload must not contain model or e2ee");
  }
  const secret = encoder.encode(String(password ?? ""));
  if (!secret.length) throw new E2eeKeyError("The E2EE password is empty");

  const ephemeral = x25519.utils.randomSecretKey();
  const epk = x25519.getPublicKey(ephemeral);
  const shared = x25519.getSharedSecret(ephemeral, nodePublic);
  const resolvedKid = keyId(nodePublic);
  const nonce = randomBytes(16);

  const requestKey = innerKey(secret, nonce, shared, "request");
  const innerIv = randomBytes(12);
  const innerCt = aesGcm(requestKey, innerIv, innerAad(path, nonce)).encrypt(
    pad(canonicalJson(payload ?? {}), padding),
  );

  const outerIv = randomBytes(12);
  const outerCt = aesGcm(
    outerKey(shared, epk, nodePublic),
    outerIv,
    outerAad(resolvedKid, model, path, nonce),
  ).encrypt(
    pad(
      canonicalJson({
        password,
        iv: b64e(innerIv),
        ct: b64e(innerCt),
      }),
      padding,
    ),
  );

  return {
    body: {
      model,
      e2ee: {
        v: VERSION,
        scheme: SCHEME,
        kid: resolvedKid,
        epk: b64e(epk),
        iv: b64e(outerIv),
        nonce: b64e(nonce),
        ct: b64e(outerCt),
      },
    },
    responseKey: innerKey(secret, nonce, shared, "response"),
    nonce,
    kid: resolvedKid,
  };
}

/** Reverses `sealRequest`. Used by tests and by the server-side reference. */
export function openRequest({ body, path, nodePrivate, minPasswordBytes = MIN_PASSWORD_BYTES }) {
  if (!body || typeof body !== "object") {
    throw new E2eeMalformedError("Request body must be a JSON object");
  }
  const extra = Object.keys(body).filter(
    (key) => key !== "model" && key !== "e2ee",
  );
  if (extra.length) {
    throw new E2eeMalformedError(
      `Unencrypted request field(s) not allowed: ${extra.sort().join(", ")}`,
    );
  }
  const model = body.model;
  const envelope = body.e2ee;
  if (typeof model !== "string" || !model) {
    throw new E2eeMalformedError("Missing model");
  }
  if (!envelope || typeof envelope !== "object") {
    throw new E2eeMalformedError("Missing e2ee envelope");
  }
  if (envelope.v !== VERSION || envelope.scheme !== SCHEME) {
    throw new E2eeMalformedError("Unsupported E2EE envelope");
  }
  const kid = String(envelope.kid ?? "");
  const epk = b64d(envelope.epk);
  const iv = b64d(envelope.iv);
  const nonce = b64d(envelope.nonce);
  const ciphertext = b64d(envelope.ct);
  const nodePublic = x25519.getPublicKey(nodePrivate);
  const shared = x25519.getSharedSecret(nodePrivate, epk);
  let padded;
  try {
    padded = aesGcm(
      outerKey(shared, epk, nodePublic),
      iv,
      outerAad(kid, model, path, nonce),
    ).decrypt(ciphertext);
  } catch {
    throw new E2eeDecryptError("The request envelope failed authentication");
  }
  const outer = JSON.parse(decoder.decode(unpad(padded)));
  if (!outer || typeof outer !== "object") {
    throw new E2eeMalformedError("Outer payload must be a JSON object");
  }
  const password = outer.password;
  if (typeof password !== "string") {
    throw new E2eeMalformedError("Outer payload carries no password");
  }
  const secret = encoder.encode(password);
  if (secret.length < minPasswordBytes) {
    throw new E2eeMalformedError(
      `The E2EE password must be at least ${minPasswordBytes} bytes`,
    );
  }
  const requestKey = innerKey(secret, nonce, shared, "request");
  let inner;
  try {
    inner = aesGcm(requestKey, b64d(outer.iv), innerAad(path, nonce)).decrypt(
      b64d(outer.ct),
    );
  } catch {
    throw new E2eeDecryptError("The encrypted request payload failed authentication");
  }
  const payload = JSON.parse(decoder.decode(unpad(inner)));
  if (!payload || typeof payload !== "object") {
    throw new E2eeMalformedError("Encrypted request payload must be a JSON object");
  }
  if ("model" in payload || "e2ee" in payload || "password" in payload) {
    throw new E2eeMalformedError("Encrypted payload must not repeat reserved fields");
  }
  return {
    model,
    kid,
    nonce,
    payload,
    responseKey: innerKey(secret, nonce, shared, "response"),
  };
}

/** Reverses `ResponseDecryptor`: used by tests and server-side tooling. */
export class ResponseSealer {
  constructor(responseKey, { padding = DEFAULT_PADDING } = {}) {
    this.key = responseKey;
    this.padding = padding;
    this.seq = 0;
  }

  seal(plaintext) {
    const iv = randomBytes(12);
    const seq = this.seq;
    this.seq += 1;
    const ct = aesGcm(this.key, iv, responseAad(seq)).encrypt(
      pad(encoder.encode(plaintext), this.padding),
    );
    return {
      e2ee: {
        v: VERSION,
        scheme: SCHEME,
        seq,
        iv: b64e(iv),
        ct: b64e(ct),
      },
    };
  }

  event(data) {
    return this.seal(String(data));
  }

  final() {
    return this.seal(JSON.stringify(FINAL));
  }
}

/** Reverses `ResponseSealer` and rejects gaps, replays and truncation. */
export class ResponseDecryptor {
  constructor(responseKey) {
    this.key = responseKey;
    this.nextSeq = 0;
    this.finalSeen = false;
  }

  /** @returns {string|null} plaintext, or null for the authenticated final marker. */
  open(envelope) {
    if (!envelope || typeof envelope !== "object") {
      throw new E2eeMalformedError("Response e2ee field must be an object");
    }
    if (envelope.v !== VERSION || envelope.scheme !== SCHEME) {
      throw new E2eeMalformedError("Unsupported response envelope");
    }
    if (envelope.seq !== this.nextSeq) {
      throw new E2eeMalformedError(
        `Response event out of order: expected ${this.nextSeq}, got ${envelope.seq}`,
      );
    }
    let padded;
    try {
      padded = aesGcm(
        this.key,
        b64d(envelope.iv),
        responseAad(envelope.seq),
      ).decrypt(b64d(envelope.ct));
    } catch (error) {
      if (error instanceof E2eeError) throw error;
      throw new E2eeDecryptError("Response event failed authentication");
    }
    this.nextSeq += 1;
    const plaintext = decoder.decode(unpad(padded));
    let parsed;
    try {
      parsed = JSON.parse(plaintext);
    } catch {
      return plaintext;
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      parsed.saia_e2ee_final === true
    ) {
      this.finalSeen = true;
      return null;
    }
    return plaintext;
  }
}

/** Decrypts a non-streaming response that keeps `model`/`usage` cleartext. */
export function openJsonResponse(response, responseKey) {
  const envelope = response?.e2ee;
  if (!envelope || typeof envelope !== "object") return response;
  const decryptor = new ResponseDecryptor(responseKey);
  const plaintext = decryptor.open(envelope);
  if (plaintext === null) {
    throw new E2eeMalformedError("Non-streaming response contained a final marker");
  }
  const parsed = JSON.parse(plaintext);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new E2eeMalformedError("Decrypted response must be a JSON object");
  }
  return parsed;
}

export function verifyFinal(decryptor) {
  if (!decryptor.finalSeen) {
    throw new E2eeTruncatedError(
      "Encrypted stream ended without its final marker",
    );
  }
}

export { FINAL as FINAL_MARKER };
