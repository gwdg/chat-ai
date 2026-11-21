import { db } from "./index";
import type { SyncMetaRow, SyncRecordRow } from "./dbTypes";
import type { RecordState, SyncStateStore } from "../sync/types";

/**
 * Engine state in Dexie.
 *
 * Raw table access stays inside `db/` (see AGENTS.md §4.2). The sync engine
 * only sees the `SyncStateStore` interface, so it can be tested against an
 * in-memory implementation.
 */
export const syncState: SyncStateStore = {
  async get(namespace, id) {
    const row = await db.sync_records.get([namespace, id]);
    return row ? { ...row } : undefined;
  },
  async put(state: RecordState) {
    await db.sync_records.put({ ...state });
  },
  async remove(namespace, id) {
    await db.sync_records.delete([namespace, id]);
  },
  async list(namespace) {
    return (await db.sync_records.where("namespace").equals(namespace).toArray()).map(
      (row) => ({ ...row }),
    );
  },
  async getMeta<T = any>(key: string) {
    const row = await db.sync_meta.get(key);
    return (row?.value ?? undefined) as T | undefined;
  },
  async setMeta(key, value) {
    const row: SyncMetaRow = { key, value };
    await db.sync_meta.put(row);
  },
  async deleteMeta(key) {
    await db.sync_meta.delete(key);
  },
  async clear() {
    await db.transaction("rw", [db.sync_meta, db.sync_records], async () => {
      await db.sync_meta.clear();
      await db.sync_records.clear();
    });
  },
};

/** Drop every sync bookkeeping row (used when the remote archive is reset). */
export async function clearSyncState(): Promise<void> {
  await syncState.clear();
}
