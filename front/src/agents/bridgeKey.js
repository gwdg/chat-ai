/**
 * The per-chat bridge key.
 *
 * `bridgeKey` in `front.json` (`VITE_BRIDGE_KEY`) is one value for the whole deployment and
 * ships inside the bundle, so every browser that loads the app knows it. This key is generated
 * here instead: 32 random bytes, one per chat, kept in localStorage so a reload reuses it.
 *
 * It has two jobs, and both need the same value:
 *
 * - it travels in the body of `POST …/bridge/sessions`, so the host can remember it for that
 *   session;
 * - it is put into the environment of every stdio MCP entry this app registers
 *   (`CHAT_AI_BRIDGE_KEY`) — the bridge sidecar and each authenticated server's proxy — so the
 *   process that attaches on the agent leg can present it.
 *
 * The host then accepts an agent socket only when it presents the key its session was created
 * with. A key that never left this page therefore pairs the two legs even where no deployment
 * secret is configured.
 */

/** Where the per-chat keys live. A map, so a second tab and a reload find the same value. */
export const BRIDGE_KEYS_STORAGE = "chatai.bridge.keys";

/**
 * How many chat keys are remembered. Each OpenCode session costs one, and a session list grows
 * without bound, so the oldest entries are dropped instead of growing localStorage forever.
 * Dropping one is harmless: its stdio entries are re-registered with the new key the next time
 * that chat's bridge starts.
 */
const MAX_KEYS = 200;

const encodeBase64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** A fresh 256-bit key. Unpredictable, URL- and header-safe (43 characters). */
export function randomBridgeKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

/** The scope a key belongs to: one chat, i.e. one OpenCode session of one agent. */
export function bridgeKeyScope(agentId, sessionId) {
  const agent = String(agentId ?? "").trim();
  if (!agent) return "";
  return `${agent}:${String(sessionId ?? "").trim() || "default"}`;
}

const readKeys = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BRIDGE_KEYS_STORAGE) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Unparseable storage is treated as empty: a lost key only means a new one.
    return {};
  }
};

const writeKeys = (keys) => {
  try {
    window.localStorage.setItem(BRIDGE_KEYS_STORAGE, JSON.stringify(keys));
  } catch {
    // Private mode or a full quota: the key still works for this page load.
  }
};

/**
 * The key for one chat, generated on first use.
 *
 * Without a scope there is nothing to remember it against, so the caller gets a fresh key and
 * nothing is stored — a bridge session is always created for an agent, so this only happens in
 * a half-initialised page.
 */
export function bridgeKeyFor(scope) {
  if (!scope) return randomBridgeKey();
  const keys = readKeys();
  const existing = keys[scope];
  if (typeof existing === "string" && existing) return existing;

  const key = randomBridgeKey();
  keys[scope] = key;
  const scopes = Object.keys(keys);
  for (const stale of scopes.slice(0, Math.max(0, scopes.length - MAX_KEYS))) {
    delete keys[stale];
  }
  writeKeys(keys);
  return key;
}

/** Forget every stored key. Used by tests; a real reload is meant to reuse them. */
export function clearBridgeKeys() {
  try {
    window.localStorage.removeItem(BRIDGE_KEYS_STORAGE);
  } catch {
    // Nothing stored.
  }
}
