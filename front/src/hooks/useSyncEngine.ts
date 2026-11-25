import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { isSyncEnabled } from "../utils/modules";
import {
  getSyncStatus,
  loadSyncStatus,
  runSyncIfDue,
  setSyncPreferences,
  startAutoSync,
  stopAutoSync,
  subscribeSyncStatus,
  unlockSyncVaultWithPasskey,
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
  // The stored status has to be known before a passkey attempt can decide
  // whether this device even has one.
  const [loaded, setLoaded] = useState(false);
  const passkeyAttempted = useRef(false);
  // A tab opened in the background must not pop an authenticator dialog the
  // user cannot see; it asks when it is brought to the front instead.
  const [visible, setVisible] = useState(
    () =>
      typeof document === "undefined" || document.visibilityState === "visible",
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

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
        if (!active) return;
        setStatus(next);
        setLoaded(true);
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

  // No passphrase after a reload: as soon as the app is up with a local passkey
  // binding for this vault, ask the authenticator. A passkey is only useful
  // when something will sync on its own, so a paused automatic synchronization
  // asks nothing here; the sidebar's "Sync now" unlocks on demand instead. The
  // attempt is best effort and happens once per mount, and only in the tab the
  // user is looking at: a browser that wants a click fails silently, an explicit
  // "Lock now" in this session suppresses it in the service, and the "Unlock
  // with passkey" button in Data settings stays the fallback.
  useEffect(() => {
    if (!loaded || !enabled || !auto || !visible || passkeyAttempted.current) {
      return;
    }
    const current = getSyncStatus();
    if (current.unlocked || !current.configured) return;
    if (!current.passkey) return;
    passkeyAttempted.current = true;
    void unlockSyncVaultWithPasskey({ silent: true }).catch(() => undefined);
  }, [loaded, enabled, auto, visible]);

  // An unlocked vault in the visible tab is the one that should hold the
  // freshest copy, so a due pass runs here rather than waiting for the next
  // timer tick. The due check keeps re-mounts and quick tab switches from
  // starting a pass of their own.
  useEffect(() => {
    if (!status.unlocked || !visible) return;
    runSyncIfDue();
  }, [status.unlocked, visible]);

  return status;
}
