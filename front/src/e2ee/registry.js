// Reads the user's E2EE key registry from the persisted settings and resolves
// a model id to its node key.
//
// A model is "keyed" when `user_settings.e2ee_models[modelId]` names an entry
// in `user_settings.e2ee_keys` that parses as a 32-byte X25519 public key.
// Anything else is unkeyed and travels in cleartext as before.
import { E2eeKeyError, keyId, parsePublicKey } from "./protocol";

const EMPTY = Object.freeze({ keys: [], models: {} });

// The store is imported on demand: this module is also loaded by components,
// and a static import would drag redux-persist and the cross-tab sync into
// every test that renders a model list.
let storePromise;
function loadStore() {
  storePromise ??= import("../Redux/store/store");
  return storePromise;
}

export function normalizeE2eeKeys(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (key) =>
      key &&
      typeof key === "object" &&
      typeof key.id === "string" &&
      key.id &&
      typeof key.publicKey === "string" &&
      key.publicKey.trim(),
  );
}

export function normalizeE2eeModels(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([modelId, keyIdValue]) =>
        typeof modelId === "string" &&
        modelId &&
        typeof keyIdValue === "string" &&
        keyIdValue,
    ),
  );
}

/** Returns the key with its parsed bytes and derived key id, or null if unusable. */
export function usableKey(entry) {
  if (!entry || typeof entry !== "object") return null;
  try {
    const publicKey = parsePublicKey(entry.publicKey);
    return { ...entry, publicKeyBytes: publicKey, kid: keyId(publicKey) };
  } catch {
    return null;
  }
}

export function findKeyForAssignment(keys, assignment) {
  if (!assignment) return null;
  return (
    (keys || []).find(
      (key) =>
        key?.id === assignment ||
        key?.kid === assignment ||
        usableKey(key)?.kid === assignment,
    ) || null
  );
}

export function assignmentFor(state, modelId) {
  if (!modelId || typeof modelId !== "string") return null;
  return state?.models?.[modelId] || null;
}

/** Whether the model list should show the green lock for `modelId`. */
export function isModelKeyed(state, modelId) {
  return Boolean(usableKey(findKeyForAssignment(state?.keys, assignmentFor(state, modelId))));
}

/**
 * The key material a request must be sealed with, or null for an unkeyed model.
 * An assignment that points at a missing or invalid key throws: a keyed model
 * must never silently fall back to cleartext.
 */
export function resolveModelKey(state, modelId) {
  const assignment = assignmentFor(state, modelId);
  if (!assignment) return null;
  const key = findKeyForAssignment(state?.keys, assignment);
  if (!key) {
    throw new E2eeKeyError(
      `No E2EE key is configured for model "${modelId}". Add the key in Settings → Encryption or remove the model's key assignment.`,
    );
  }
  const usable = usableKey(key);
  if (!usable) {
    throw new E2eeKeyError(
      `The E2EE key "${key.name || key.id}" assigned to model "${modelId}" is not a valid 32-byte X25519 public key. Fix or remove it in Settings → Encryption.`,
    );
  }
  return { key: usable, nodePublic: usable.publicKeyBytes, kid: usable.kid };
}

/** Reads the live registry outside React (fetch wrapper, Meta tools). */
export async function readE2eeState() {
  try {
    const { store } = await loadStore();
    const settings = store.getState()?.user_settings;
    return {
      keys: normalizeE2eeKeys(settings?.e2ee_keys),
      models: normalizeE2eeModels(settings?.e2ee_models),
    };
  } catch {
    // Without a live store nothing is keyed. That is a read, not a keyed model:
    // resolution still fails closed, because an assignment it cannot see cannot
    // exist either.
    return EMPTY;
  }
}

export async function resolveKeyForModel(modelId) {
  return resolveModelKey(await readE2eeState(), modelId);
}
