import { sha256Hex, toBytes } from "./crypto/bytes";

/**
 * Stable JSON for hashing and encryption.
 *
 * Object keys are sorted and `undefined` is dropped, so two devices that hold
 * the same values produce the same bytes regardless of insertion order. Arrays
 * keep their order: message order is data.
 */
export function canonicalJson(value: unknown): string {
  const encode = (input: unknown): string => {
    if (input === null) return "null";
    const type = typeof input;
    if (type === "string") return JSON.stringify(input);
    if (type === "number") return Number.isFinite(input as number) ? String(input) : "null";
    if (type === "boolean") return input ? "true" : "false";
    if (type === "bigint") return JSON.stringify(String(input));
    if (Array.isArray(input)) {
      return `[${input.map((item) => (item === undefined ? "null" : encode(item))).join(",")}]`;
    }
    if (type === "object") {
      const record = input as Record<string, unknown>;
      const keys = Object.keys(record)
        .filter((key) => record[key] !== undefined && typeof record[key] !== "function")
        .sort();
      return `{${keys.map((key) => `${JSON.stringify(key)}:${encode(record[key])}`).join(",")}}`;
    }
    return "null";
  };
  return encode(value);
}

/** Content hash of a record payload; the merge is decided on this, never on time. */
export const hashPayload = (payload: unknown): string =>
  sha256Hex(toBytes(canonicalJson(payload)));

/** The canonical payload bytes that are sealed into a record. */
export const payloadBytes = (payload: unknown): Uint8Array =>
  toBytes(canonicalJson(payload));
