import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { isSyncEnabled } from "../utils/modules";
import {
  getSyncStatus,
  loadSyncStatus,
  setSyncPreferences,
  startAutoSync,
  stopAutoSync,
  subscribeSyncStatus,
  type SyncStatus,
} from "../sync/service";

/**
 * App-level sync state. Mounted once (ChatPage), it restores the stored status,
 * then follows the service and keeps the five-minute timer alive. The timer is
 * a no-op while the vault is locked, so a reload never syncs by itself.
 *
 * `user_settings.sync` is read here rather than inside `sync/service.ts`: a
 * static store import there would put `redux-state-sync` (and its
 * `BroadcastChannel`) on the import path of every modal, which tests that only
 * render the sidebar do not provide.
 */
// The Data tab mounts this too, and one unmount must not stop the timer the
// other mount still needs.
let activeMounts = 0;

export function useSyncEngine(): SyncStatus {
  const enabled = useSelector(
    (state: any) => state.user_settings?.sync?.enabled === true,
  );
  const auto = useSelector(
    (state: any) => state.user_settings?.sync?.auto !== false,
  );
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);

  // Preferences first: the effect below reads them when it starts the timer.
  useEffect(() => {
    setSyncPreferences({ enabled, auto });
  }, [enabled, auto]);

  useEffect(() => {
    if (!isSyncEnabled()) return undefined;
    let active = true;
    activeMounts += 1;
    const unsubscribe = subscribeSyncStatus((next) => {
      if (active) setStatus(next);
    });
    void loadSyncStatus()
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch(() => undefined);
    startAutoSync();
    return () => {
      active = false;
      unsubscribe();
      activeMounts = Math.max(0, activeMounts - 1);
      if (activeMounts === 0) stopAutoSync();
    };
  }, []);

  return status;
}
