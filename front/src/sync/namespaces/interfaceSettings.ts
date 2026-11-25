import { hashPayload } from "../canonical";
import type {
  LocalRecord,
  MergeBase,
  RemoteRecord,
  SyncConflict,
  SyncNamespace,
} from "../types";
import {
  DEVICE_ONLY_INTERFACE_SETTINGS,
  importInterfaceSettings,
} from "../../Redux/reducers/interfaceSettingsSlice";
import { deepEqual, mergeSettings } from "./settingsMerge";

/**
 * The single interface-settings record.
 *
 * `interface_settings` lives in Redux and localStorage, so this namespace reads
 * it from the store and writes it back through `importInterfaceSettings`, which
 * validates every key. Presentation preferences (theme, sort order, warning
 * dialogs, completed tours) follow the account, so a new device does not have to
 * be configured twice.
 *
 * Keys that describe the window or this device — the sidebar, the collapse
 * lists, counters, the web-search consent and the first-run offer decision — are
 * never uploaded and never overwritten by a pull. `keepsBase` stores the last
 * agreed payload next to the revision, which is the ancestor the three-way merge
 * needs.
 */
export const INTERFACE_SETTINGS_RECORD_ID = "interface-settings";

const DEVICE_ONLY = new Set<string>(DEVICE_ONLY_INTERFACE_SETTINGS);

export type InterfaceSettingsAccess = {
  read(): any | Promise<any>;
  apply(payload: any): void | Promise<void>;
};

/**
 * The store is imported on demand, exactly like the settings namespace: a static
 * import would put redux-persist and the cross-tab sync on the import path of
 * every test that renders a modal.
 */
const reduxAccess: InterfaceSettingsAccess = {
  async read() {
    const { store } = await import("../../Redux/store/store");
    return store.getState().interface_settings;
  },
  async apply(payload) {
    const { store } = await import("../../Redux/store/store");
    store.dispatch(importInterfaceSettings(payload));
  },
};

const plain = (value: any) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

/** Drop the device-local keys, so they cannot travel to another device. */
const accountPayload = (value: any) => {
  const out: Record<string, any> = {};
  for (const [key, entry] of Object.entries(value ?? {})) {
    if (DEVICE_ONLY.has(key)) continue;
    out[key] = entry;
  }
  return plain(out) ?? {};
};

export function createInterfaceSettingsNamespace(
  access: InterfaceSettingsAccess = reduxAccess,
): SyncNamespace {
  let conflicts: SyncConflict[] = [];

  const recordOf = (payload: any): LocalRecord => ({
    namespace: "interface_settings",
    id: INTERFACE_SETTINGS_RECORD_ID,
    hash: hashPayload(payload),
    payload,
    title: "Interface settings",
  });

  return {
    name: "interface_settings",
    keepsBase: true,
    async list() {
      return [recordOf(accountPayload(await access.read()))];
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
          namespace: "interface_settings",
          id: INTERFACE_SETTINGS_RECORD_ID,
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
      return "Interface settings";
    },
  };
}
