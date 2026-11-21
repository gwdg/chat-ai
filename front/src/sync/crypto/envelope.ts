import { gcm } from "@noble/ciphers/aes.js";

import { concat, random, toBytes } from "./bytes";

/**
 * Blob container: `CASSYNC1` (8 bytes) | flags (1) | IV (12) | ciphertext.
 *
 * The AAD is not stored: it is derived from the slot the blob occupies, which
 * is what binds a blob to its record revision. Compression is optional so the
 * module also works where `CompressionStream` does not exist.
 */
const MAGIC = toBytes("CASSYNC1");
const FLAG_GZIP = 1;
const IV_BYTES = 12;
const HEADER_BYTES = MAGIC.length + 1 + IV_BYTES;

export const ENVELOPE_OVERHEAD_BYTES = HEADER_BYTES + 16;

const hasCompression = () =>
  typeof CompressionStream !== "undefined" &&
  typeof DecompressionStream !== "undefined";

const pipeThrough = async (
  bytes: Uint8Array,
  stream: { readable: ReadableStream; writable: WritableStream },
): Promise<Uint8Array> => {
  const response = new Response(
    new Blob([bytes]).stream().pipeThrough(stream as TransformStream),
  );
  return new Uint8Array(await response.arrayBuffer());
};

const gzip = async (bytes: Uint8Array): Promise<Uint8Array> => {
  if (!hasCompression()) return bytes;
  try {
    return await pipeThrough(bytes, new CompressionStream("gzip"));
  } catch {
    return bytes;
  }
};

const gunzip = async (bytes: Uint8Array): Promise<Uint8Array> => {
  try {
    return await pipeThrough(bytes, new DecompressionStream("gzip"));
  } catch {
    throw new Error("The sync blob is compressed but this browser cannot decompress it.");
  }
};

export const sealBlob = async (
  key: Uint8Array,
  aad: string,
  plaintext: Uint8Array,
): Promise<Uint8Array> => {
  if (!(key instanceof Uint8Array) || key.length !== 32) {
    throw new Error("A sync blob needs a 32-byte key.");
  }
  const compressed = await gzip(plaintext);
  const flags = compressed === plaintext ? 0 : FLAG_GZIP;
  const iv = random(IV_BYTES);
  const ciphertext = gcm(key, iv, toBytes(aad)).encrypt(compressed);
  return concat(MAGIC, new Uint8Array([flags]), iv, ciphertext);
};

const startsWithMagic = (bytes: Uint8Array): boolean => {
  if (bytes.length < MAGIC.length) return false;
  for (let i = 0; i < MAGIC.length; i += 1) {
    if (bytes[i] !== MAGIC[i]) return false;
  }
  return true;
};

export const openBlob = async (
  key: Uint8Array,
  aad: string,
  blob: Uint8Array,
): Promise<Uint8Array> => {
  if (!startsWithMagic(blob) || blob.length < HEADER_BYTES + 16) {
    throw new Error("This file is not a Chat AI sync blob.");
  }
  const flags = blob[MAGIC.length];
  const iv = blob.subarray(MAGIC.length + 1, HEADER_BYTES);
  const ciphertext = blob.subarray(HEADER_BYTES);
  let plaintext: Uint8Array;
  try {
    plaintext = gcm(key, iv, toBytes(aad)).decrypt(ciphertext);
  } catch {
    // Covers a wrong passphrase and a tampered or truncated blob alike.
    throw new Error("The sync blob could not be decrypted.");
  }
  if (flags & FLAG_GZIP) return gunzip(plaintext);
  return plaintext;
};
