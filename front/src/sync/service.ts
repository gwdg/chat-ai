import { syncState } from "../db/syncState";
import type { SyncStateStore } from "./types";
import type { SyncStore } from "./storage/types";
import { SaiaFsSyncStore } from "./storage/saiaFsStore";
import { MemorySyncStore } from "./storage/memoryStore";
import {
  collectGarbage,
  readVaultHeader,
  readIndex,
  runSync,
  writeVaultHeader,
} from "./engine";
import {
  changePassphrase as rewrapVault,
  createVault,
  isValidHeader,
  unlockVault,
  vaultFingerprint,
  VaultError,
  type VaultHeader,
  type VaultKeys,
} from "./crypto/vault";
import { createDefaultNamespaces } from "./namespaces";
import {
  createPasskeyBinding,
  isPasskeyBinding,
  isPasskeySupported,
  PasskeyError,
  unwrapVaultKeysWithPasskey,
  type PasskeyBinding,
} from "./passkey";
import type { SyncSummary } from "./types";

/**
 * The user-facing side of sync: the vault lifecycle, the in-memory key, the
 * one-run-at-a-time lock and the auto-sync timer.
 *
 * Nothing here persists the passphrase or the vault key. A reload locks the
 * vault, and the Data tab asks for the passphrase again. The remote header is
 * cached in `sync_meta` so status survives a reload, but the cache holds no key
 * material either.
 */

const META_DEVICE_ID = "deviceId";
const META_HEADER = "vault-header";
const META_LAST_SUMMARY = "last-summary";
const META_PASSKEY = "passkey-binding";

/**
 * Session-only hint that a passkey opened the vault in this tab. It holds only
 * the `vaultId`, so a reload can ask the passkey again instead of going quiet;
 * closing the tab forgets it and the explicit "Lock vault" clears it.
 */
const PASSKEY_SESSION_KEY = "chatai.sync.passkey-session";

export const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const SYNC_LOCK_NAME = "chatai-sync";

export type SyncStatus = {
  /** The user switched the server synchronization on. */
  enabled: boolean;
  /** A vault header is known (locally or remotely). */
  configured: boolean;
  /** The vault key is in memory and a sync may run. */
  unlocked: boolean;
  /** A passkey is enrolled for this vault on this device. */
  passkey: boolean;
  /** The enrolled passkey's label, for the settings panel. */
  passkeyLabel: string | null;
  /** This browser can use WebAuthn PRF at all. */
  passkeySupported: boolean;
  running: boolean;
  deviceId: string | null;
  vaultId: string | null;
  fingerprint: string | null;
  lastRunAt: number | null;
  lastSummary: SyncSummary | null;
  conflicts: number;
  skipped: number;
  error: string | null;
  progress: { phase: string; done: number; total: number } | null;
};

export type SyncDeps = {
  createStore(): SyncStore;
  state: SyncStateStore;
  namespaces(): ReturnType<typeof createDefaultNamespaces>;
};

const defaultDeps: SyncDeps = {
  createStore: () => new SaiaFsSyncStore(),
  state: syncState,
  namespaces: createDefaultNamespaces,
};

let deps: SyncDeps = defaultDeps;
let storeInstance: SyncStore | null = null;
let header: VaultHeader | null = null;
let keys: VaultKeys | null = null;
let passkeyBinding: PasskeyBinding | null = null;
// The app-level hook and the Data panel can both ask for the passkey right
// after a reload; one authenticator prompt answers both.
let passkeyUnlock: Promise<SyncStatus> | null = null;
// "Lock now" has to survive a page transition, because every page mounts
// `useSyncEngine` again. The flag is module state, so it lasts for this app
// session and a reload (a fresh module) may ask again.
let autoUnlockSuppressed = false;
let deviceId: string | null = null;
let running: Promise<SyncSummary> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let listenersInstalled = false;

const listeners = new Set<(status: SyncStatus) => void>();

let status: SyncStatus = {
  enabled: false,
  configured: false,
  unlocked: false,
  passkey: false,
  passkeyLabel: null,
  passkeySupported: false,
  running: false,
  deviceId: null,
  vaultId: null,
  fingerprint: null,
  lastRunAt: null,
  lastSummary: null,
  conflicts: 0,
  skipped: 0,
  error: null,
  progress: null,
};

/**
 * The two preferences that decide whether sync runs. They live in Redux, but
 * this module must not import the store: `SyncSettings` is reachable from the
 * modal context, so a static import would pull `redux-state-sync` (and its
 * `BroadcastChannel`) into every test that only renders the sidebar. The hook
 * that mounts the engine feeds them in from `useSelector` instead.
 */
let preferences = { enabled: false, auto: true };

/** Called by `useSyncEngine` whenever `user_settings.sync` changes. */
export function setSyncPreferences(next: {
  enabled?: boolean;
  auto?: boolean;
}): void {
  const enabled = next.enabled ?? preferences.enabled;
  const auto = next.auto ?? preferences.auto;
  if (enabled === preferences.enabled && auto === preferences.auto) return;
  // Turning the synchronization back on is an explicit decision, so it may ask
  // for the passkey again even after an explicit lock in this session.
  if (enabled && !preferences.enabled) autoUnlockSuppressed = false;
  preferences = { enabled, auto };
  status = { ...status, enabled };
  for (const listener of listeners) listener(snapshot());
}

/**
 * The status plus the two values that are derived rather than stored: WebAuthn
 * support comes from the browser and `passkey` requires the binding to belong
 * to the header currently loaded.
 */
const snapshot = (): SyncStatus => ({
  ...status,
  enabled: preferences.enabled,
  passkeySupported: isPasskeySupported(),
  passkey: Boolean(
    passkeyBinding && header && passkeyBinding.vaultId === header.vaultId,
  ),
  passkeyLabel:
    passkeyBinding && header && passkeyBinding.vaultId === header.vaultId
      ? passkeyBinding.label
      : null,
});

const emit = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch, enabled: preferences.enabled };
  for (const listener of listeners) listener(snapshot());
};

export function getSyncStatus(): SyncStatus {
  return snapshot();
}

export function subscribeSyncStatus(
  listener: (status: SyncStatus) => void,
): () => void {
  listeners.add(listener);
  listener(getSyncStatus());
  return () => listeners.delete(listener);
}

/** Test seam: inject an in-memory store and state, and reset the module. */
export function configureSyncDeps(next: Partial<SyncDeps>): void {
  deps = { ...defaultDeps, ...next };
  storeInstance = null;
}

export function resetSyncServiceForTests(): void {
  stopAutoSync();
  deps = defaultDeps;
  storeInstance = null;
  header = null;
  keys = null;
  passkeyBinding = null;
  passkeyUnlock = null;
  autoUnlockSuppressed = false;
  deviceId = null;
  running = null;
  preferences = { enabled: false, auto: true };
  forgetPasskeySession();
  status = {
    enabled: false,
    configured: false,
    unlocked: false,
    passkey: false,
    passkeySupported: false,
    running: false,
    deviceId: null,
    vaultId: null,
    fingerprint: null,
    lastRunAt: null,
    lastSummary: null,
    conflicts: 0,
    skipped: 0,
    error: null,
    progress: null,
  };
}

/** A plain in-memory pair for tests and the "try it" path. */
export function memorySyncDeps(): Partial<SyncDeps> {
  const store = new MemorySyncStore();
  return { createStore: () => store };
}

const getStore = (): SyncStore => {
  if (!storeInstance) storeInstance = deps.createStore();
  return storeInstance;
};

const ensureDeviceId = async (): Promise<string> => {
  if (deviceId) return deviceId;
  const stored = await deps.state.getMeta<string>(META_DEVICE_ID);
  if (stored) {
    deviceId = stored;
    return stored;
  }
  const fresh =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  deviceId = fresh;
  await deps.state.setMeta(META_DEVICE_ID, fresh);
  return fresh;
};

const cacheHeader = async (value: VaultHeader) => {
  header = value;
  await deps.state.setMeta(META_HEADER, value);
  emit({ configured: true, vaultId: value.vaultId });
};

const cachedHeader = async (): Promise<VaultHeader | null> => {
  if (header) return header;
  const stored = await deps.state.getMeta<VaultHeader>(META_HEADER);
  if (stored && isValidHeader(stored)) {
    header = stored;
    emit({ configured: true, vaultId: stored.vaultId });
    return stored;
  }
  return null;
};

const errorMessage = (error: unknown): string => {
  if (error instanceof VaultError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return String(error ?? "Unknown sync error");
};

const fail = (error: unknown) => {
  emit({ error: errorMessage(error) });
  throw error;
};

type PasskeySession = { vaultId: string; at: number };

const readPasskeySession = (): PasskeySession | null => {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PASSKEY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.vaultId === "string"
      ? { vaultId: parsed.vaultId, at: Number(parsed.at) || 0 }
      : null;
  } catch {
    // A blocked or full session storage only means the hint is missing.
    return null;
  }
};

const writePasskeySession = (vaultId: string) => {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      PASSKEY_SESSION_KEY,
      JSON.stringify({ vaultId, at: Date.now() }),
    );
  } catch {
    // Best effort: the passkey button still works without the hint.
  }
};

/**
 * Drop the session hint. Called by the explicit lock and whenever the vault is
 * replaced, because the passkey would no longer open it.
 */
export function forgetPasskeySession(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(PASSKEY_SESSION_KEY);
  } catch {
    // Ignore a storage the browser refuses to touch.
  }
}

/**
 * True when this browser session already opened `vaultId` with its passkey.
 * The Data tab uses it to explain which way the session unlocked; it is not a
 * secret and not a precondition for asking again, because an automatic attempt
 * runs whenever a binding for the current vault exists.
 */
export function didPasskeyUnlockSession(
  vaultId: string | null | undefined,
): boolean {
  if (!vaultId) return false;
  return readPasskeySession()?.vaultId === vaultId;
}

/** Browser support, surfaced so the UI can hide the controls entirely. */
export function isSyncPasskeySupported(): boolean {
  return isPasskeySupported();
}

const loadPasskeyBinding = async (): Promise<PasskeyBinding | null> => {
  if (passkeyBinding) return passkeyBinding;
  const stored = await deps.state.getMeta<PasskeyBinding>(META_PASSKEY);
  if (isPasskeyBinding(stored)) {
    passkeyBinding = stored;
    return stored;
  }
  return null;
};

const dropPasskeyBinding = async () => {
  passkeyBinding = null;
  await deps.state.deleteMeta(META_PASSKEY).catch(() => undefined);
};

/** Label of the enrolled passkey, or null when the vault has none. */
export async function getSyncPasskeyLabel(): Promise<string | null> {
  const stored = await loadPasskeyBinding();
  return stored?.label ?? null;
}

/** True when this device holds a passkey for the current vault. */
export async function hasSyncPasskey(): Promise<boolean> {
  const stored = await loadPasskeyBinding();
  return Boolean(stored && header && stored.vaultId === header.vaultId);
}

/**
 * Enrol a passkey for the unlocked vault. Only the wrapped vault key is stored;
 * the PRF secret stays in the authenticator and the vault keys in memory.
 */
export async function registerSyncPasskey(
  label = "Chat AI sync vault",
): Promise<SyncStatus> {
  try {
    if (!keys || !header) {
      throw new VaultError("PASSPHRASE_REQUIRED", "Unlock the vault first.");
    }
    const binding = await createPasskeyBinding(keys, header.vaultId, label);
    await deps.state.setMeta(META_PASSKEY, binding);
    passkeyBinding = binding;
    writePasskeySession(binding.vaultId);
    emit({ error: null });
    return getSyncStatus();
  } catch (error) {
    return fail(error);
  }
}

/**
 * Unlock the current vault with its passkey. The passphrase stays the fallback,
 * and a binding that belongs to a replaced vault is discarded instead of being
 * offered again.
 *
 * Concurrent callers share one prompt: after a reload the app-level hook and
 * the Data panel can both ask at the same moment, and two
 * `navigator.credentials.get()` calls would be two dialogs (or one rejected).
 */
export function unlockSyncVaultWithPasskey(
  options: { silent?: boolean } = {},
): Promise<SyncStatus> {
  if (passkeyUnlock) return passkeyUnlock;
  passkeyUnlock = unlockWithPasskeyOnce(options).finally(() => {
    passkeyUnlock = null;
  });
  return passkeyUnlock;
}

async function unlockWithPasskeyOnce(
  options: { silent?: boolean },
): Promise<SyncStatus> {
  try {
    // A silent attempt is the automatic one after a page load. An explicit
    // "Lock now" in this app session must not be undone by it, so only the
    // visible button (`silent` unset) may ask while the suppression is on.
    if (options.silent && autoUnlockSuppressed) {
      throw new PasskeyError(
        "CANCELLED",
        "The vault was locked in this session.",
      );
    }
    const current = await loadHeader();
    if (!current) {
      throw new VaultError(
        "INVALID_VAULT",
        "There is no encrypted copy on this account yet.",
      );
    }
    const binding = await loadPasskeyBinding();
    if (!binding || binding.vaultId !== current.vaultId) {
      if (binding) await dropPasskeyBinding();
      throw new PasskeyError(
        "MISMATCH",
        "No passkey is stored for this vault. Use the passphrase.",
      );
    }
    keys = await unwrapVaultKeysWithPasskey(binding, current.vaultId);
    await ensureDeviceId();
    autoUnlockSuppressed = false;
    writePasskeySession(current.vaultId);
    emit({
      unlocked: true,
      fingerprint: vaultFingerprint(keys),
      error: null,
    });
    return getSyncStatus();
  } catch (error) {
    // An unattended retry after a reload must not paint a red banner when the
    // browser wants a click first; the passphrase and the button remain.
    if (options.silent) {
      emit({ error: null });
      throw error;
    }
    return fail(error);
  }
}

/** Forget the passkey on this device. The vault and the archive stay intact. */
export async function forgetSyncPasskey(): Promise<void> {
  await dropPasskeyBinding();
  forgetPasskeySession();
  emit({});
}

/**
 * Read the header from the remote, falling back to the cached copy when the
 * filesystem cannot be reached. A rotated remote always wins: it is the one the
 * other devices see.
 */
async function loadHeader(options: { remote?: boolean } = {}): Promise<VaultHeader | null> {
  if (options.remote !== false) {
    try {
      const remote = await readVaultHeader(getStore());
      if (remote) {
        await cacheHeader(remote);
        return remote;
      }
    } catch (error) {
      const cached = await cachedHeader();
      if (cached) return cached;
      throw error;
    }
  }
  return cachedHeader();
}

/** True when the remote already holds a vault (another device created it). */
export async function hasRemoteVault(): Promise<boolean> {
  try {
    return Boolean(await readVaultHeader(getStore()));
  } catch {
    return false;
  }
}

/** Turn the server synchronization on by creating a new vault on the filesystem. */
export async function createSyncVault(
  passphrase: string,
  options: { replace?: boolean } = {},
): Promise<SyncStatus> {
  try {
    const existing = await readVaultHeader(getStore()).catch(() => null);
    if (existing && !options.replace) {
      throw new VaultError(
        "INVALID_VAULT",
        "An encrypted copy already exists for this account. Unlock it instead.",
      );
    }
    if (existing && options.replace) {
      await deps.state.clear().catch(() => undefined);
    }
    const created = await createVault(passphrase);
    await writeVaultHeader(getStore(), created.header);
    await cacheHeader(created.header);
    await ensureDeviceId();
    keys = created.keys;
    autoUnlockSuppressed = false;
    // A new vault id invalidates any passkey enrolled for the old one.
    await dropPasskeyBinding();
    forgetPasskeySession();
    emit({
      unlocked: true,
      fingerprint: vaultFingerprint(created.keys),
      error: null,
    });
    return getSyncStatus();
  } catch (error) {
    return fail(error);
  }
}

/** Unlock an existing vault with its passphrase. */
export async function unlockSyncVault(passphrase: string): Promise<SyncStatus> {
  try {
    const current = await loadHeader();
    if (!current) {
      throw new VaultError(
        "INVALID_VAULT",
        "There is no encrypted copy on this account yet.",
      );
    }
    keys = await unlockVault(current, passphrase);
    await ensureDeviceId();
    autoUnlockSuppressed = false;
    emit({
      unlocked: true,
      fingerprint: vaultFingerprint(keys),
      error: null,
    });
    return getSyncStatus();
  } catch (error) {
    return fail(error);
  }
}

/** Drop the vault key from memory. The remote data is untouched. */
export function lockSyncVault(): void {
  keys = null;
  // An explicit lock sticks for this app session: neither another page mount
  // nor the Data tab may pop the authenticator again on its own. The reload
  // that starts a new session asks with the passkey again, and the explicit
  // "Unlock with passkey" button keeps working meanwhile.
  autoUnlockSuppressed = true;
  forgetPasskeySession();
  emit({ unlocked: false, progress: null });
}

/**
 * Re-wrap the same vault key under a new passphrase. Every record stays
 * readable, so this is the cheap "I want a different passphrase" operation.
 */
export async function changeSyncPassphrase(nextPassphrase: string): Promise<SyncStatus> {
  try {
    if (!keys || !header) {
      throw new VaultError("PASSPHRASE_REQUIRED", "Unlock the vault first.");
    }
    const next = await rewrapVault(header, keys, nextPassphrase);
    await writeVaultHeader(getStore(), next.header);
    await cacheHeader(next.header);
    return getSyncStatus();
  } catch (error) {
    return fail(error);
  }
}

/**
 * Replace the vault: a new salt, a new vault key and a new `vaultId`. Every
 * existing blob becomes undecryptable, so the whole archive is re-uploaded.
 * This is how a device is revoked.
 */
export async function rotateSyncVault(passphrase: string): Promise<SyncStatus> {
  try {
    if (!keys) throw new VaultError("PASSPHRASE_REQUIRED", "Unlock the vault first.");
    const created = await createVault(passphrase);
    await deps.state.clear();
    await writeVaultHeader(getStore(), created.header);
    await cacheHeader(created.header);
    keys = created.keys;
    autoUnlockSuppressed = false;
    passkeyBinding = null;
    forgetPasskeySession();
    deviceId = null;
    emit({
      unlocked: true,
      fingerprint: vaultFingerprint(created.keys),
      lastSummary: null,
      lastRunAt: null,
      conflicts: 0,
      skipped: 0,
      error: null,
    });
    return getSyncStatus();
  } catch (error) {
    return fail(error);
  }
}

const withLock = async <T>(run: () => Promise<T>): Promise<T> => {
  const locks = typeof navigator !== "undefined" ? (navigator as any).locks : null;
  if (!locks?.request) return run();
  return locks.request(SYNC_LOCK_NAME, { mode: "exclusive" }, run);
};

/** Replace the remote index and delete unreferenced revisions and assets. */
export async function cleanUpRemote(): Promise<{ records: number; assets: number }> {
  if (!keys) throw new VaultError("PASSPHRASE_REQUIRED", "Unlock the vault first.");
  return collectGarbage({ store: getStore(), keys });
}

/** Remote identity of the vault for display; never key material. */
export async function remoteVaultSummary(): Promise<{
  vaultId: string;
  devices: number;
  fragments: number;
  records: number;
  unreadable: number;
} | null> {
  if (!keys) return null;
  const index = await readIndex(getStore(), keys);
  return {
    vaultId: header?.vaultId ?? "",
    devices: index.devices.size,
    fragments: index.fragments,
    records: index.records.size,
    unreadable: index.unreadable,
  };
}

/**
 * One sync pass. Concurrent callers share the same run, so the five-minute
 * timer and a manual "Sync now" cannot write two fragments at once.
 */
export async function syncNow(): Promise<SyncSummary> {
  if (!keys) throw new VaultError("PASSPHRASE_REQUIRED", "Unlock the vault first.");
  if (running) return running;
  emit({ running: true, error: null, progress: { phase: "prepare", done: 0, total: 1 } });
  running = withLock(async () => {
    const id = await ensureDeviceId();
    return runSync({
      store: getStore(),
      keys: keys!,
      namespaces: deps.namespaces(),
      state: deps.state,
      deviceId: id,
      onProgress: (progress) =>
        emit({
          progress: {
            phase: progress.phase,
            done: progress.done,
            total: progress.total,
          },
        }),
    });
  })
    .then(async (summary) => {
      await deps.state.setMeta(META_LAST_SUMMARY, summary);
      emit({
        running: false,
        progress: null,
        lastRunAt: summary.at,
        lastSummary: summary,
        conflicts: summary.conflicts.length,
        skipped: summary.skipped.length,
        error: null,
      });
      return summary;
    })
    .catch((error) => {
      emit({ running: false, progress: null, error: errorMessage(error) });
      throw error;
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** Restore the last summary from a previous page load (the key stays locked). */
export async function loadSyncStatus(): Promise<SyncStatus> {
  const [storedHeader, storedSummary, storedDevice, storedPasskey] =
    await Promise.all([
      deps.state.getMeta<VaultHeader>(META_HEADER),
      deps.state.getMeta<SyncSummary>(META_LAST_SUMMARY),
      deps.state.getMeta<string>(META_DEVICE_ID),
      deps.state.getMeta<PasskeyBinding>(META_PASSKEY),
    ]);
  if (storedHeader && isValidHeader(storedHeader)) header = storedHeader;
  if (storedDevice) deviceId = storedDevice;
  passkeyBinding = isPasskeyBinding(storedPasskey) ? storedPasskey : null;
  emit({
    configured: Boolean(header),
    vaultId: header?.vaultId ?? null,
    lastSummary: storedSummary ?? null,
    lastRunAt: storedSummary?.at ?? null,
    conflicts: storedSummary?.conflicts.length ?? 0,
    skipped: storedSummary?.skipped.length ?? 0,
    deviceId: storedDevice ?? null,
  });
  return getSyncStatus();
}

/** A hidden tab is not "active": only the foreground tab may sync on its own. */
const tabIsActive = (): boolean =>
  typeof document === "undefined" || document.visibilityState === "visible";

/** The next automatic pass waits for the interval, measured from the last run. */
const autoSyncDue = (): boolean =>
  Date.now() - (status.lastRunAt ?? 0) >= AUTO_SYNC_INTERVAL_MS;

const runAuto = () => {
  if (!keys || !preferences.auto || running) return;
  // Several tabs share one browser profile and one remote archive. Only the tab
  // the user is looking at runs the background pass, so a hidden tab does not
  // duplicate every pull and push; it catches up when it becomes visible again.
  if (!tabIsActive()) return;
  void syncNow().catch(() => undefined);
};

/** Start the timer once; it is a no-op while the vault is locked or the tab is hidden. */
export function startAutoSync(): void {
  if (timer) return;
  timer = setInterval(runAuto, AUTO_SYNC_INTERVAL_MS);
  if (!listenersInstalled && typeof document !== "undefined") {
    listenersInstalled = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      // Returning to a tab is not a reason for an extra pass: the timer keeps
      // ticking here, and a pass that is already due runs now.
      if (autoSyncDue()) runAuto();
    });
  }
}

export function stopAutoSync(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Interval hook for the UI: sync when a run finishes and the vault is open. */
export function runSyncIfUnlocked(): void {
  runAuto();
}

/**
 * Run an automatic pass only when the interval has elapsed. Used after an
 * unlock and when a hidden tab comes to the front: both are moments where the
 * tab may be behind, but neither is a reason to sync more often than the timer.
 */
export function runSyncIfDue(): void {
  if (autoSyncDue()) runAuto();
}
