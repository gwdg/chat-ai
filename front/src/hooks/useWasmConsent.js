import { useSyncExternalStore } from "react";

// Remember that the user agreed to download a heavy WebAssembly feature. The
// browser caches the actual assets; this flag only avoids asking on every block.
const STORAGE_PREFIX = "chatai.wasm-consent.v1.";
const listeners = new Set();
const cache = new Map();

function read(feature) {
  if (cache.has(feature)) return cache.get(feature);
  let granted = false;
  try {
    granted = localStorage.getItem(`${STORAGE_PREFIX}${feature}`) === "granted";
  } catch {
    granted = false;
  }
  cache.set(feature, granted);
  return granted;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hasWasmConsent(feature) {
  return read(feature);
}

export function grantWasmConsent(...features) {
  for (const feature of features) {
    cache.set(feature, true);
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${feature}`, "granted");
    } catch {
      // Storage can be unavailable; the in-memory flag still applies this session.
    }
  }
  listeners.forEach((listener) => listener());
}

export function useWasmConsent(feature) {
  return useSyncExternalStore(
    subscribe,
    () => read(feature),
    () => false
  );
}
