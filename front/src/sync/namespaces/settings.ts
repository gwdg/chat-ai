import { importUserSettings } from "../../Redux/reducers/userSettingsReducer";
import { hashPayload } from "../canonical";
import type {
  LocalRecord,
  MergeBase,
  RemoteRecord,
  SyncConflict,
  SyncNamespace,
} from "../types";
import { deepEqual, mergeSettings } from "./settingsMerge";

/**
 * The single settings record.
 *
 * `user_settings` lives in Redux and localStorage, not Dexie, so this namespace
 * reads it from the store and writes it back through `importUserSettings`,
 * which already validates every field. `keepsBase` makes the engine store the
 * last agreed payload next to the revision, which is the ancestor the three-way
 * merge needs.
 */
export const SETTINGS_RECORD_ID = "user-settings";

export type SettingsAccess = {
  read(): any | Promise<any>;
  apply(payload: any): void | Promise<void>;
};

/**
 * The store is imported on demand. `createSettingsNamespace` is reachable from
 * the modal context (`SyncSettings` → service → namespaces), and a static store
 * import would construct `redux-state-sync` in any test that renders a modal —
 * that needs a `BroadcastChannel` jsdom does not provide.
 */
const reduxAccess: SettingsAccess = {
  async read() {
    const { store } = await import("../../Redux/store/store");
    return store.getState().user_settings;
  },
  async apply(payload) {
    const { store } = await import("../../Redux/store/store");
    store.dispatch(importUserSettings(payload));
  },
};

const plain = (value: any) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export function createSettingsNamespace(
  access: SettingsAccess = reduxAccess,
): SyncNamespace {
  let conflicts: SyncConflict[] = [];

  const recordOf = (payload: any): LocalRecord => ({
    namespace: "settings",
    id: SETTINGS_RECORD_ID,
    hash: hashPayload(payload),
    payload,
    title: "Settings",
  });

  return {
    name: "settings",
    keepsBase: true,
    async list() {
      const payload = plain(await access.read()) ?? {};
      return [recordOf(payload)];
    },
    async apply(record: RemoteRecord) {
      await access.apply(plain(record.payload) ?? {});
    },
    async merge(
      local: LocalRecord,
      remote: RemoteRecord,
      base: MergeBase | undefined,
    ) {
      const merged = mergeSettings(base?.payload, local.payload, remote.payload);
      for (const key of merged.conflicts) {
        conflicts.push({
          namespace: "settings",
          id: SETTINGS_RECORD_ID,
          title: key,
          reason: "merge",
        });
      }
      // The merged object is the new local truth, not only the remote's.
      if (!deepEqual(merged.payload, local.payload)) {
        await access.apply(merged.payload);
      }
      if (deepEqual(merged.payload, remote.payload)) return "remote";
      return recordOf(merged.payload);
    },
    takeConflicts() {
      const out = conflicts;
      conflicts = [];
      return out;
    },
    titleOf() {
      return "Settings";
    },
  };
}
