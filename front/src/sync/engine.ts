import { hashPayload, payloadBytes } from "./canonical";
import {
  fromBase64Url,
  fromBytes,
  sha256Hex,
  toBase64Url,
  toBytes,
} from "./crypto/bytes";
import { openBlob, sealBlob } from "./crypto/envelope";
import { isValidHeader, type VaultHeader, type VaultKeys } from "./crypto/vault";
import type { SyncStore } from "./storage/types";
import type {
  ApplyContext,
  LocalRecord,
  MergeBase,
  RecordState,
  RemoteRecord,
  SyncNamespace,
  SyncProgress,
  SyncStateStore,
  SyncSummary,
} from "./types";

/**
 * Remote layout (see docs/sync.md):
 *
 *   /.chat-ai-sync/v1/vault.json                        cleartext header
 *   /.chat-ai-sync/v1/index/<deviceId>.bin              one writer per fragment
 *   /.chat-ai-sync/v1/records/<ns>/<id>.<rev>-<dev>.bin immutable revisions
 *   /.chat-ai-sync/v1/assets/<sha256>.bin               content-addressed blobs
 *
 * Nothing here overwrites another device's file: revisions and fragments are
 * named after their writer, and the merged view is a union of all fragments.
 */

export const SYNC_ROOT = "/.chat-ai-sync/v1";
export const SYNC_VAULT_PATH = `${SYNC_ROOT}/vault.json`;
export const SYNC_INDEX_DIR = `${SYNC_ROOT}/index`;
export const SYNC_RECORDS_DIR = `${SYNC_ROOT}/records`;
export const SYNC_ASSETS_DIR = `${SYNC_ROOT}/assets`;
export const SYNC_FORMAT_VERSION = 1;
export const SYNC_TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const SUFFIX = ".bin";

export const recordAad = (namespace: string, id: string, rev: number) =>
  `chatai-sync/v1/record/${namespace}/${id}/${rev}`;
export const assetAad = (sha256: string) => `chatai-sync/v1/asset/${sha256}`;
export const fragmentAad = (deviceId: string) =>
  `chatai-sync/v1/index/${deviceId}`;

const encodeId = (id: string) => toBase64Url(toBytes(id));
const decodeId = (value: string) => fromBytes(fromBase64Url(value));
const shortDevice = (deviceId: string) =>
  deviceId.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "device";

/** `<encoded id>.<rev>-<device>.bin`, the immutable name of one revision. */
export const recordFileName = (id: string, rev: number, deviceId: string) =>
  `${encodeId(id)}.${rev}-${shortDevice(deviceId)}${SUFFIX}`;

export type FragmentEntry = { rev: number; hash: string; deviceId: string };

export type Fragment = {
  v: number;
  deviceId: string;
  at: number;
  records: Record<string, FragmentEntry>;
  deleted: Record<string, number>;
  devices: Record<string, number>;
};

export type MergedIndex = {
  records: Map<string, FragmentEntry>;
  deleted: Map<string, number>;
  devices: Map<string, number>;
  fragments: number;
  unreadable: number;
};

export const recordKey = (namespace: string, id: string) => `${namespace}:${id}`;

/** Where the engine keeps the payload a namespace asked to remember. */
export const baseKeyOf = (namespace: string, id: string) =>
  `base:${namespace}:${id}`;

export const ensureLayout = async (store: SyncStore): Promise<void> => {
  await store.ensureDir(SYNC_ROOT);
  await store.ensureDir(SYNC_INDEX_DIR);
  await store.ensureDir(SYNC_RECORDS_DIR);
  await store.ensureDir(SYNC_ASSETS_DIR);
};

export async function readVaultHeader(
  store: SyncStore,
): Promise<VaultHeader | null> {
  if (!(await store.exists(SYNC_VAULT_PATH))) return null;
  const bytes = await store.read(SYNC_VAULT_PATH);
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBytes(bytes));
  } catch {
    throw new Error("The sync vault header is not valid JSON.");
  }
  if (!isValidHeader(parsed)) {
    throw new Error("The sync vault header belongs to an unknown format.");
  }
  return parsed;
}

export async function writeVaultHeader(
  store: SyncStore,
  header: VaultHeader,
): Promise<void> {
  await store.ensureDir(SYNC_ROOT);
  await store.write(SYNC_VAULT_PATH, toBytes(JSON.stringify(header, null, 2)));
}

const emptyFragment = (deviceId: string, now: number): Fragment => ({
  v: SYNC_FORMAT_VERSION,
  deviceId,
  at: now,
  records: {},
  deleted: {},
  devices: { [deviceId]: now },
});

const isFragment = (value: any): value is Fragment =>
  Boolean(
    value &&
      typeof value.deviceId === "string" &&
      value.records &&
      typeof value.records === "object" &&
      value.deleted &&
      typeof value.deleted === "object",
  );

/** Read and decrypt every device fragment. Unreadable ones are counted, not fatal. */
export async function readIndex(
  store: SyncStore,
  keys: VaultKeys,
): Promise<MergedIndex> {
  await store.ensureDir(SYNC_INDEX_DIR);
  const merged: MergedIndex = {
    records: new Map(),
    deleted: new Map(),
    devices: new Map(),
    fragments: 0,
    unreadable: 0,
  };
  let entries;
  try {
    entries = await store.list(SYNC_INDEX_DIR);
  } catch {
    return merged;
  }
  for (const entry of entries) {
    if (!entry.name.endsWith(SUFFIX)) continue;
    const deviceId = entry.name.slice(0, -SUFFIX.length);
    let fragment: Fragment;
    try {
      const bytes = await store.read(`${SYNC_INDEX_DIR}/${entry.name}`);
      const plaintext = await openBlob(
        keys.blobKey,
        fragmentAad(deviceId),
        bytes,
      );
      const parsed = JSON.parse(fromBytes(plaintext));
      if (!isFragment(parsed)) throw new Error("bad fragment");
      fragment = parsed;
    } catch {
      // A fragment of a previous vault (after a rotation) or a partial write.
      merged.unreadable += 1;
      continue;
    }
    merged.fragments += 1;
    for (const [key, value] of Object.entries(fragment.records ?? {})) {
      const current = merged.records.get(key);
      if (
        !current ||
        value.rev > current.rev ||
        (value.rev === current.rev && value.hash > current.hash)
      ) {
        merged.records.set(key, value);
      }
    }
    for (const [key, at] of Object.entries(fragment.deleted ?? {})) {
      const current = merged.deleted.get(key) ?? 0;
      if (at > current) merged.deleted.set(key, at);
    }
    for (const [id, at] of Object.entries(fragment.devices ?? {})) {
      merged.devices.set(id, Math.max(merged.devices.get(id) ?? 0, Number(at) || 0));
    }
  }
  return merged;
}

export type RunSyncOptions = {
  store: SyncStore;
  keys: VaultKeys;
  namespaces: SyncNamespace[];
  state: SyncStateStore;
  deviceId: string;
  now?: number;
  onProgress?: (progress: SyncProgress) => void;
};

/**
 * One full pass: read the merged remote index, reconcile every namespace
 * record, then publish this device's fragment.
 */
export async function runSync(options: RunSyncOptions): Promise<SyncSummary> {
  const { store, keys, namespaces, state, deviceId } = options;
  const now = options.now ?? Date.now();
  const onProgress = options.onProgress;
  const summary: SyncSummary = {
    at: now,
    pulled: 0,
    pushed: 0,
    deleted: 0,
    skipped: [],
    conflicts: [],
  };

  await ensureLayout(store);

  const previousFragment = await readOwnFragment(store, keys, deviceId);
  const index = await readIndex(store, keys);

  const assetNames = new Set(
    (await store.list(SYNC_ASSETS_DIR).catch(() => [])).map((e) => e.name),
  );
  const assetCache = new Map<string, Uint8Array | null>();

  const ctx: ApplyContext = {
    now,
    deviceId,
    readAsset: async (sha256: string) => {
      if (assetCache.has(sha256)) return assetCache.get(sha256) ?? null;
      let bytes: Uint8Array | null = null;
      try {
        const blob = await store.read(`${SYNC_ASSETS_DIR}/${sha256}.bin`);
        bytes = await openBlob(keys.assetKey, assetAad(sha256), blob);
        if (sha256Hex(bytes) !== sha256) bytes = null;
      } catch {
        bytes = null;
      }
      assetCache.set(sha256, bytes);
      return bytes;
    },
  };

  const nextRecords: Record<string, FragmentEntry> = {};
  const nextDeleted: Record<string, number> = {};

  // The local base rows are the engine's only record of "what the remote already
  // has". They are therefore committed *after* this device's fragment is
  // published (see the end of the function): if the fragment write fails, the
  // state still describes the last published pass, so the next run redoes the
  // work instead of mistaking its own unpublished revision for an older remote
  // one and pulling that back over a newer local edit.
  type StateWrite =
    | {
        kind: "put";
        entry: RecordState;
        base?: { payload?: any; keep?: boolean };
      }
    | { kind: "remove"; namespace: string; id: string };
  const stateWrites: StateWrite[] = [];
  const commitState = async () => {
    for (const write of stateWrites) {
      if (write.kind === "remove") {
        await state.remove(write.namespace, write.id);
        await state
          .deleteMeta(baseKeyOf(write.namespace, write.id))
          .catch(() => undefined);
        continue;
      }
      await state.put(write.entry);
      if (write.base?.keep) {
        await state.setMeta(
          baseKeyOf(write.entry.namespace, write.entry.id),
          { hash: write.entry.hash, payload: write.base.payload },
        );
      }
    }
  };

  const putState = async (
    namespace: string,
    id: string,
    rev: number,
    hash: string,
    base?: { payload?: any; keep?: boolean },
  ) => {
    const entry: RecordState = { namespace, id, rev, hash };
    stateWrites.push({ kind: "put", entry, base });
    nextRecords[recordKey(namespace, id)] = { rev, hash, deviceId };
  };

  const removeState = async (namespace: string, id: string) => {
    stateWrites.push({ kind: "remove", namespace, id });
    delete nextRecords[recordKey(namespace, id)];
  };

  const loadRemote = async (
    namespace: string,
    id: string,
    entry: FragmentEntry,
  ): Promise<RemoteRecord> => {
    const path = `${SYNC_RECORDS_DIR}/${namespace}/${recordFileName(id, entry.rev, entry.deviceId)}`;
    const blob = await store.read(path);
    const plaintext = await openBlob(
      keys.blobKey,
      recordAad(namespace, id, entry.rev),
      blob,
    );
    const payload = JSON.parse(fromBytes(plaintext));
    const hash = hashPayload(payload);
    if (hash !== entry.hash) {
      throw new Error(
        `The remote copy of ${namespace}/${id} does not match its index entry.`,
      );
    }
    return {
      namespace,
      id,
      rev: entry.rev,
      hash,
      payload,
      deviceId: entry.deviceId,
    };
  };

  const pull = async (ns: SyncNamespace, id: string, entry: FragmentEntry) => {
    onProgress?.({ phase: "pull", namespace: ns.name, done: 0, total: 1 });
    const remote = await loadRemote(ns.name, id, entry);
    await ns.apply(remote, ctx);
    await putState(ns.name, id, remote.rev, remote.hash, {
      payload: remote.payload,
      keep: ns.keepsBase,
    });
    summary.pulled += 1;
  };

  const push = async (ns: SyncNamespace, local: LocalRecord) => {
    onProgress?.({ phase: "push", namespace: ns.name, done: 0, total: 1 });
    for (const asset of local.assets ?? []) {
      const name = `${asset.sha256}.bin`;
      if (assetNames.has(name)) continue;
      const sealed = await sealBlob(
        keys.assetKey,
        assetAad(asset.sha256),
        asset.bytes,
      );
      await store.write(`${SYNC_ASSETS_DIR}/${name}`, sealed);
      assetNames.add(name);
    }
    const remoteEntry = index.records.get(recordKey(ns.name, local.id));
    const rev = Math.max(now, (remoteEntry?.rev ?? 0) + 1);
    const sealed = await sealBlob(
      keys.blobKey,
      recordAad(ns.name, local.id, rev),
      payloadBytes(local.payload),
    );
    await store.write(
      `${SYNC_RECORDS_DIR}/${ns.name}/${recordFileName(local.id, rev, deviceId)}`,
      sealed,
    );
    await putState(ns.name, local.id, rev, local.hash, {
      payload: local.payload,
      keep: ns.keepsBase,
    });
    summary.pushed += 1;
  };

  /** Keep a divergent remote version as a second local record, then keep ours. */
  const duplicateAndPush = async (
    ns: SyncNamespace,
    id: string,
    entry: FragmentEntry,
    local: LocalRecord,
  ) => {
    if (ns.duplicate) {
      try {
        const remote = await loadRemote(ns.name, id, entry);
        await ns.duplicate(remote, ctx);
      } catch {
        // The local copy still gets pushed; the conflict stays in the summary.
      }
    }
    await push(ns, local);
  };

  for (const ns of namespaces) {
    // One directory per namespace; the provider does not create parents on write.
    await store.ensureDir(`${SYNC_RECORDS_DIR}/${ns.name}`);
    const locals = await ns.list();
    const localById = new Map(locals.map((record) => [record.id, record]));
    const bases = await state.list(ns.name);
    const baseById = new Map(bases.map((base) => [base.id, base]));

    const ids = new Set<string>([...localById.keys(), ...baseById.keys()]);
    const prefix = `${ns.name}:`;
    for (const key of index.records.keys()) {
      if (key.startsWith(prefix)) ids.add(key.slice(prefix.length));
    }
    for (const key of index.deleted.keys()) {
      if (key.startsWith(prefix)) ids.add(key.slice(prefix.length));
    }

    for (const id of ids) {
      const key = recordKey(ns.name, id);
      const local = localById.get(id);
      const base = baseById.get(id);
      const remoteEntry = index.records.get(key);
      const tombstone = index.deleted.get(key);

      try {
        // ---- the record is gone locally ----
        if (!local) {
          if (remoteEntry && (!base || remoteEntry.hash !== base.hash)) {
            await pull(ns, id, remoteEntry);
            continue;
          }
          if (base) {
            // Deleted here. A tombstone stops other devices from resurrecting it.
            nextDeleted[key] = Math.max(now, base.rev + 1);
            await removeState(ns.name, id);
            summary.deleted += 1;
          }
          continue;
        }

        // ---- another device deleted it ----
        if (tombstone !== undefined && base && tombstone > base.rev) {
          if (local.hash === base.hash) {
            await ns.remove?.(id);
            await removeState(ns.name, id);
            summary.deleted += 1;
            continue;
          }
          // The local edit is newer than the deletion: resurrect by pushing.
          await push(ns, local);
          continue;
        }

        if (!remoteEntry) {
          // First push, or the remote revision vanished: pushing repairs it.
          await push(ns, local);
          continue;
        }

        if (remoteEntry.hash === local.hash) {
          // Same content on both sides; adopt the remote revision as the base.
          await putState(ns.name, id, remoteEntry.rev, remoteEntry.hash, {
            payload: local.payload,
            keep: ns.keepsBase,
          });
          continue;
        }

        // Both sides differ from the base (or there is no base at all, which
        // means the first contact between two independent archives).
        const remote = await loadRemote(ns.name, id, remoteEntry);
        const resolve = async () => {
          if (ns.merge) {
            let mergeBase: MergeBase | undefined = base;
            if (base && ns.keepsBase) {
              // The common ancestor's payload lives beside the state row.
              const stored = await state.getMeta<{ hash: string; payload?: any }>(
                baseKeyOf(ns.name, id),
              );
              if (stored?.hash === base.hash) {
                mergeBase = { ...base, payload: stored.payload };
              }
            }
            const outcome = await ns.merge(local, remote, mergeBase, ctx);
            if (outcome === "remote") {
              await ns.apply(remote, ctx);
              await putState(ns.name, id, remote.rev, remote.hash, {
                payload: remote.payload,
                keep: ns.keepsBase,
              });
              summary.pulled += 1;
              return;
            }
            await push(ns, outcome === "local" ? local : outcome);
            return;
          }
          if (ns.extends?.(local.payload, remote.payload)) {
            await ns.apply(remote, ctx);
            await putState(ns.name, id, remote.rev, remote.hash, {
              payload: remote.payload,
              keep: ns.keepsBase,
            });
            summary.pulled += 1;
            return;
          }
          summary.conflicts.push({
            namespace: ns.name,
            id,
            title: ns.titleOf?.(local.payload) ?? local.title ?? id,
            reason: "diverged",
          });
          await duplicateAndPush(ns, id, remoteEntry, local);
        };

        if (!base) {
          // Two independent records with the same id: keep both, unless the
          // namespace can merge them (a singleton such as settings).
          if (ns.merge) {
            await resolve();
            continue;
          }
          summary.conflicts.push({
            namespace: ns.name,
            id,
            title: ns.titleOf?.(local.payload) ?? local.title ?? id,
            reason: "diverged",
          });
          await duplicateAndPush(ns, id, remoteEntry, local);
          continue;
        }

        const localUnchanged = base.hash === local.hash;
        const remoteUnchanged = remoteEntry.hash === base.hash;

        if (localUnchanged) {
          await pull(ns, id, remoteEntry);
          continue;
        }

        if (remoteUnchanged) {
          await push(ns, local);
          continue;
        }

        await resolve();
      } catch (error) {
        // One unreadable record must not abandon the rest of the run.
        summary.skipped.push(
          `${ns.name}/${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    for (const skipped of ns.takeSkipped?.() ?? []) {
      summary.skipped.push(`${ns.name}: ${skipped}`);
    }
    for (const conflict of ns.takeConflicts?.() ?? []) {
      summary.conflicts.push(conflict);
    }
  }

  // Publish this device's view. Listing everything we know (not only this run's
  // pushes) is what lets a fresh device read a single fragment and see the
  // archive; tombstones still win over older revisions.
  const own = previousFragment ?? emptyFragment(deviceId, now);
  const fragment: Fragment = {
    v: SYNC_FORMAT_VERSION,
    deviceId,
    at: now,
    records: { ...own.records, ...nextRecords },
    deleted: pruneTombstones({ ...own.deleted, ...nextDeleted }, index, now),
    devices: {
      ...own.devices,
      ...Object.fromEntries(index.devices),
      [deviceId]: now,
    },
  };
  for (const key of Object.keys(fragment.records)) {
    if (fragment.deleted[key] !== undefined) delete fragment.records[key];
  }
  const sealed = await sealBlob(
    keys.blobKey,
    fragmentAad(deviceId),
    toBytes(JSON.stringify(fragment)),
  );
  await store.write(`${SYNC_INDEX_DIR}/${deviceId}.bin`, sealed);

  // Only now do the base rows follow: the fragment above is what every other
  // device and the next pass read, and it is written last on purpose.
  await commitState();

  onProgress?.({ phase: "done", done: 1, total: 1 });
  return summary;
}

/**
 * Remove remote revisions and assets that no merged index entry references.
 * Called explicitly ("Clean up remote"), never from `runSync`: a normal sync
 * must not delete data it did not write.
 */
export async function collectGarbage(options: {
  store: SyncStore;
  keys: VaultKeys;
}): Promise<{ records: number; assets: number }> {
  const { store, keys } = options;
  const index = await readIndex(store, keys);
  const live = new Set(index.records.keys());

  let records = 0;
  const dirs = await store.list(SYNC_RECORDS_DIR).catch(() => []);
  for (const dir of dirs) {
    if (dir.dir === false) continue;
    const entries = await store
      .list(`${SYNC_RECORDS_DIR}/${dir.name}`)
      .catch(() => []);
    for (const entry of entries) {
      const [encodedId] = entry.name.split(".");
      let id = "";
      try {
        id = decodeId(encodedId);
      } catch {
        id = "";
      }
      const liveEntry = id ? index.records.get(recordKey(dir.name, id)) : undefined;
      // Keep exactly the revision the merged index names; a superseded revision
      // of a live record is just as unreferenced as one of a deleted record.
      const expected = liveEntry
        ? recordFileName(id, liveEntry.rev, liveEntry.deviceId)
        : null;
      if (!expected || entry.name !== expected) {
        await store.remove(`${SYNC_RECORDS_DIR}/${dir.name}/${entry.name}`);
        records += 1;
      }
    }
  }

  const referenced = new Set<string>();
  const assetEntries = await store.list(SYNC_ASSETS_DIR).catch(() => []);
  // Collect referenced hashes from the live records themselves.
  for (const key of live) {
    const [namespace, ...rest] = key.split(":");
    const id = rest.join(":");
    const entry = index.records.get(key);
    if (!entry) continue;
    try {
      const remote = await store.read(
        `${SYNC_RECORDS_DIR}/${namespace}/${recordFileName(id, entry.rev, entry.deviceId)}`,
      );
      const plaintext = await openBlob(
        keys.blobKey,
        recordAad(namespace, id, entry.rev),
        remote,
      );
      const payload = JSON.parse(fromBytes(plaintext));
      collectHashes(payload, referenced);
    } catch {
      // An unreadable live record keeps its assets: better than deleting them.
      for (const asset of assetEntries) referenced.add(asset.name);
    }
  }
  let assets = 0;
  for (const entry of assetEntries) {
    if (referenced.has(entry.name)) continue;
    await store.remove(`${SYNC_ASSETS_DIR}/${entry.name}`);
    assets += 1;
  }
  return { records, assets };
}

const collectHashes = (value: unknown, hashes: Set<string>) => {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectHashes(item, hashes);
    return;
  }
  const record = value as Record<string, any>;
  if (typeof record.sha256 === "string") hashes.add(`${record.sha256}.bin`);
  for (const key of Object.keys(record)) collectHashes(record[key], hashes);
};

async function readOwnFragment(
  store: SyncStore,
  keys: VaultKeys,
  deviceId: string,
): Promise<Fragment | null> {
  try {
    const bytes = await store.read(`${SYNC_INDEX_DIR}/${deviceId}.bin`);
    const plaintext = await openBlob(keys.blobKey, fragmentAad(deviceId), bytes);
    const parsed = JSON.parse(fromBytes(plaintext));
    return isFragment(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function pruneTombstones(
  deleted: Record<string, number>,
  index: MergedIndex,
  now: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  const devices = [...index.devices.values()];
  for (const [key, at] of Object.entries(deleted)) {
    if (!Number.isFinite(at)) continue;
    const expired = now - at > SYNC_TOMBSTONE_TTL_MS;
    // A device that has not synced past the deletion could still hold the record,
    // so the tombstone only goes once every known device is beyond it.
    const everyonePast = devices.length > 0 && devices.every((seen) => seen > at);
    if (expired && everyonePast) continue;
    out[key] = at;
  }
  return out;
}
