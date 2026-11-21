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

export const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const SYNC_LOCK_NAME = "chatai-sync";

export type SyncStatus = {
  /** The user switched the server synchronization on. */
  enabled: boolean;
  /** A vault header is known (locally or remotely). */
  configured: boolean;
  /** The vault key is in memory and a sync may run. */
  unlocked: boolean;
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
let deviceId: string | null = null;
let running: Promise<SyncSummary> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let listenersInstalled = false;

const listeners = new Set<(status: SyncStatus) => void>();

let status: SyncStatus = {
  enabled: false,
  configured: false,
  unlocked: false,
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
  preferences = { enabled, auto };
  status = { ...status, enabled };
  for (const listener of listeners) listener(status);
}

const emit = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch, enabled: preferences.enabled };
  for (const listener of listeners) listener(status);
};

export function getSyncStatus(): SyncStatus {
  return { ...status, enabled: preferences.enabled };
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
  deviceId = null;
  running = null;
  preferences = { enabled: false, auto: true };
  status = {
    enabled: false,
    configured: false,
    unlocked: false,
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
  const [storedHeader, storedSummary, storedDevice] = await Promise.all([
    deps.state.getMeta<VaultHeader>(META_HEADER),
    deps.state.getMeta<SyncSummary>(META_LAST_SUMMARY),
    deps.state.getMeta<string>(META_DEVICE_ID),
  ]);
  if (storedHeader && isValidHeader(storedHeader)) header = storedHeader;
  if (storedDevice) deviceId = storedDevice;
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

const runAuto = () => {
  if (!keys || !preferences.auto || running) return;
  void syncNow().catch(() => undefined);
};

/** Start the timer once; it is a no-op while the vault is locked. */
export function startAutoSync(): void {
  if (timer) return;
  timer = setInterval(runAuto, AUTO_SYNC_INTERVAL_MS);
  if (!listenersInstalled && typeof document !== "undefined") {
    listenersInstalled = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") runAuto();
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
