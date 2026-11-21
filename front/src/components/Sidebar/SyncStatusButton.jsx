import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";

import { useSyncEngine } from "../../hooks/useSyncEngine";
import { useToast } from "../../hooks/useToast";
import { syncNow } from "../../sync/service";
import { isSyncEnabled } from "../../utils/modules";

/**
 * Quick action next to the user name in the sidebar footer. It only exists on
 * deployments that offer the encrypted server synchronization, and it does nothing while
 * the vault is locked (an unlock needs the passphrase, which lives in the Data
 * tab). With the vault open it runs one pass instead of waiting for the timer.
 */
export default function SyncStatusButton({ onOpenSettings }) {
  const { t } = useTranslation();
  const status = useSyncEngine();
  const { notifySuccess, notifyError } = useToast();

  if (!isSyncEnabled()) return null;

  const label = status.running
    ? t("sidebar.sync_running")
    : status.unlocked
      ? t("sidebar.sync_now")
      : t("sidebar.sync_settings");

  const handleClick = async (event) => {
    // The card around this button opens the user settings; a click here only
    // means "sync" (or "take me to the passphrase form").
    event.stopPropagation();
    if (status.running) return;
    if (!status.unlocked) {
      onOpenSettings();
      return;
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
    <button
      type="button"
      aria-label={label}
      title={label}
      data-guide="sidebar-sync"
      onClick={(event) => void handleClick(event)}
      onKeyDown={(event) => event.stopPropagation()}
      className={`btn btn-ghost btn-circle btn-sm shrink-0 ${
        status.running
          ? "text-accent"
          : status.unlocked
            ? "text-success"
            : "text-base-content/50"
      }`}
    >
      <RefreshCw
        className={`h-4 w-4 ${status.running ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
    </button>
  );
}
