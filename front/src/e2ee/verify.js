// Proves that an imported public key belongs to the node serving a model,
// before the key is stored.
//
// Parsing a key only proves it is 32 bytes. A key can be perfectly valid and
// still be the wrong key for the model's node, which would otherwise surface as
// a failed chat only after the user writes a prompt. This sends one minimal
// sealed request and requires the node to answer with a sealed body, so a wrong
// key, a non-E2EE model and an unreachable endpoint are caught at import time.
import {
  E2eeKeyError,
  openJsonResponse,
  randomPassword,
  sealRequest,
} from "./protocol";
import { usableKey } from "./registry";

export class E2eeVerifyError extends Error {
  constructor(reason, message, { modelId, status, code, detail } = {}) {
    super(message);
    this.name = "E2eeVerifyError";
    this.reason = reason;
    this.modelId = modelId;
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Sends a one-token sealed request for `modelId` with `key`.
 *
 * Resolves `{ ok: true, modelId }` only when the node accepted the envelope and
 * its answer decrypted with the session key. Throws `E2eeVerifyError` otherwise,
 * with `reason` one of: unknown_key, decrypt_failed, not_encrypted, malformed,
 * password, replay, http, network, timeout.
 */
export async function verifyKeyForModel({
  modelId,
  key,
  url,
  headers = {},
  fetchImpl = (...args) => globalThis.fetch(...args),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const usable = usableKey(key);
  if (!usable) {
    throw new E2eeKeyError(
      "The key is not a valid 32-byte X25519 public key, so it cannot be verified.",
    );
  }

  const path = new URL(
    url,
    globalThis.location?.origin ?? "http://localhost",
  ).pathname;
  // Smallest request that a node will still open and forward. The node answers
  // errors in cleartext with an `e2ee_*` code, so those are classified below.
  const session = sealRequest({
    model: modelId,
    path,
    payload: {
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      temperature: 0,
      stream: false,
    },
    nodePublic: usable.publicKeyBytes,
    password: randomPassword(),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ ...session.body, stream: false }),
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = controller.signal.aborted;
    throw new E2eeVerifyError(
      timedOut ? "timeout" : "network",
      timedOut
        ? `The verification request for "${modelId}" timed out.`
        : `Could not reach the endpoint to verify "${modelId}".`,
      { modelId, detail: error?.message },
    );
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // A proxy error page is not JSON; handled below as an HTTP failure.
  }

  if (!response.ok) {
    const code = parsed?.error?.code;
    const detail =
      parsed?.error?.message || raw || `HTTP ${response.status}`;
    throw new E2eeVerifyError(
      reasonForCode(code),
      detail,
      { modelId, status: response.status, code },
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new E2eeVerifyError(
      "not_encrypted",
      `"${modelId}" answered without a sealed body, so it is not E2EE-capable or the key is not active.`,
      { modelId, status: response.status },
    );
  }

  if (!parsed.e2ee) {
    const code = parsed.error?.code;
    throw new E2eeVerifyError(
      String(code ?? "").startsWith("e2ee_")
        ? "malformed"
        : "not_encrypted",
      parsed.error?.message ||
        `"${modelId}" answered without encryption, so it is not E2EE-capable or the key is not active.`,
      { modelId, status: response.status, code },
    );
  }

  try {
    openJsonResponse(parsed, session.responseKey);
  } catch (error) {
    throw new E2eeVerifyError(
      "decrypt_failed",
      `The sealed test answer from "${modelId}" could not be opened.`,
      { modelId, status: response.status, detail: error?.message },
    );
  }

  return { ok: true, modelId };
}

function reasonForCode(code) {
  if (code === "e2ee_unknown_key") return "unknown_key";
  if (code === "e2ee_decrypt_failed") return "decrypt_failed";
  if (code === "e2ee_password_too_short") return "password";
  if (code === "e2ee_replay") return "replay";
  if (String(code ?? "").startsWith("e2ee_")) return "malformed";
  return "http";
}
