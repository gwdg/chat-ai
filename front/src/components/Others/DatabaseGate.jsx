import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { db } from "../../db";
import ErrorScreen from "./ErrorScreen";

let listenersInstalled = false;
let reportDatabaseError = null;

/**
 * Chrome does not report a version conflict whose holder is a frozen background
 * tab — no `blocked` event ever arrives — so a stuck `db.open()` would otherwise
 * be an endless spinner with nothing to act on. After this long the gate says
 * what is probably happening and offers a retry; if the open finishes anyway the
 * app still loads.
 */
const OPEN_STALL_MS = 15000;

function databaseErrorKey(error) {
  const name = String(error?.name || "");
  if (name === "VersionError") return "errors.database_version";
  if (name === "BlockedError" || name === "blocked") {
    return "errors.database_blocked";
  }
  if (name === "StalledError") return "errors.database_stalled";
  if (name === "QuotaExceededError") return "errors.database_quota";
  return "errors.database_generic";
}

export default function DatabaseGate({ children }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    reportDatabaseError = setError;

    if (!listenersInstalled) {
      listenersInstalled = true;
      db.on("blocked", () => {
        const blocked = new Error("The local database is blocked by another tab.");
        blocked.name = "BlockedError";
        reportDatabaseError?.(blocked);
      });
      db.on("versionchange", () => {
        const changed = new Error("The local database was upgraded in another tab.");
        changed.name = "VersionError";
        try {
          db.close();
        } catch {
          // already closed
        }
        reportDatabaseError?.(changed);
      });
    }

    const clearStall = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    timer = setTimeout(() => {
      if (cancelled) return;
      const stalled = new Error("The local database did not open in time.");
      stalled.name = "StalledError";
      setError(stalled);
    }, OPEN_STALL_MS);

    db.open()
      .then(() => {
        clearStall();
        if (!cancelled) {
          // A late success after the stall warning must still load the app.
          setError(null);
          setReady(true);
        }
      })
      .catch((openError) => {
        clearStall();
        if (!cancelled) setError(openError);
      });

    return () => {
      cancelled = true;
      clearStall();
      if (reportDatabaseError === setError) reportDatabaseError = null;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    // A fresh request: close whatever the last attempt left behind, then let the
    // effect open again. Dexie would otherwise hand back the same pending open.
    try {
      db.close();
    } catch {
      // already closed or mid-upgrade
    }
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  if (error) {
    const canRetry = String(error?.name || "") !== "VersionError";
    return (
      <ErrorScreen
        title={t("errors.database_title")}
        message={t(databaseErrorKey(error))}
        details={String(error?.stack || error?.message || error)}
        reloadLabel={t("errors.reload")}
        onReload={() => window.location.reload()}
        retryLabel={canRetry ? t("errors.retry") : undefined}
        onRetry={canRetry ? retry : undefined}
      />
    );
  }

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-base-200">
        <span className="loading loading-spinner loading-lg" aria-label={t("common.loading")} />
      </div>
    );
  }

  return children;
}
