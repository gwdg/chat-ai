import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { RefreshCw } from "lucide-react";

import { useSyncEngine } from "../../hooks/useSyncEngine";
import { useToast } from "../../hooks/useToast";
import { setSyncAuto } from "../../Redux/reducers/userSettingsReducer";
import { syncNow, unlockSyncVaultWithPasskey } from "../../sync/service";
import { isSyncEnabled } from "../../utils/modules";

/**
 * Quick action next to the user name in the sidebar footer. It only exists on
 * deployments that offer the encrypted server synchronization. With the vault
 * open it runs one pass instead of waiting for the timer. A locked vault with a
 * passkey on this device unlocks right here (the click is the user gesture the
 * authenticator needs); otherwise it opens the Data tab, where the passphrase
 * lives. A paused automatic synchronization relies on exactly this button: the
 * app does not ask for the passkey at startup while nothing syncs on its own.
 *
 * Once the synchronization is switched on and a vault exists, a small switch
 * underneath pauses or resumes the automatic five-minute passes. "Sync now"
 * keeps working either way, so the switch never locks the vault.
 */
export default function SyncStatusButton({ onOpenSettings }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const status = useSyncEngine();
  const { notifySuccess, notifyError } = useToast();
  const auto = useSelector(
    (state) => state.user_settings?.sync?.auto !== false,
  );

  if (!isSyncEnabled()) return null;

  // A paused automatic synchronization never asks for the passkey on load; a
  // click on this button is the moment to unlock, and it is a user gesture, so
  // the passkey may be requested here even after an explicit "Lock now".
  const canUnlockWithPasskey =
    status.passkey === true && status.passkeySupported === true;

  const label = status.running
    ? t("sidebar.sync_running")
    : status.unlocked || canUnlockWithPasskey
      ? t("sidebar.sync_now")
      : t("sidebar.sync_settings");

  const autoLabel = auto
    ? t("sidebar.sync_auto_on")
    : t("sidebar.sync_auto_off");

  // "Set up" is the same condition as the switch: a preference for the
  // synchronization plus a vault this device knows about.
  const setup = status.enabled && status.configured;
  // Green only while the automatic passes can actually run: set up, switched on,
  // and with a usable key in memory. A cancelled passkey prompt, a refused
  // authenticator or a failed unlock therefore leaves the button blue instead of
  // claiming that synchronization is working. Blue = set up but not running on
  // its own (paused, or still locked); gray = nothing set up yet.
  const tone = !setup
    ? "text-base-content/50"
    : auto && status.unlocked
      ? "text-success"
      : "text-info";

  const handleClick = async (event) => {
    // The card around this button opens the user settings; a click here only
    // means "sync" (or "take me to the passphrase form").
    event.stopPropagation();
    if (status.running) return;
    if (!status.unlocked) {
      // Without a passkey the vault can only be opened with the passphrase,
      // which lives in Data settings. With one, this click is the user gesture
      // that may ask the authenticator; a refusal falls back to the form.
      if (!canUnlockWithPasskey) {
        onOpenSettings();
        return;
      }
      try {
        await unlockSyncVaultWithPasskey();
      } catch {
        onOpenSettings();
        return;
      }
    }
    try {
      const summary = await syncNow();
      notifySuccess(
        t("sidebar.sync_done", {
          pulled: summary.pulled,
          pushed: summary.pushed,
        }),
      );
    } catch (error) {
      notifyError(
        t("sidebar.sync_failed", {
          error: error instanceof Error ? error.message : String(error),
        }),
        5000,
      );
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <button
        type="button"
        aria-label={label}
        title={label}
        data-guide="sidebar-sync"
        onClick={(event) => void handleClick(event)}
        onKeyDown={(event) => event.stopPropagation()}
        className={`btn btn-ghost btn-circle btn-sm shrink-0 ${tone}`}
      >
        <RefreshCw
          className={`h-4 w-4 ${status.running ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
      </button>
      {status.enabled && status.configured && (
        <input
          type="checkbox"
          role="switch"
          aria-label={autoLabel}
          title={autoLabel}
          data-guide="sidebar-sync-auto"
          className={`toggle toggle-xs ${auto ? "toggle-success" : "toggle-error"}`}
          checked={auto}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onChange={(event) => dispatch(setSyncAuto(event.target.checked))}
        />
      )}
    </div>
  );
}
