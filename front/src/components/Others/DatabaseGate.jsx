import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { db } from "../../db";
import ErrorScreen from "./ErrorScreen";

let listenersInstalled = false;
let reportDatabaseError = null;

function databaseErrorKey(error) {
  const name = String(error?.name || "");
  if (name === "VersionError") return "errors.database_version";
  if (name === "BlockedError" || name === "blocked") {
    return "errors.database_blocked";
  }
  if (name === "QuotaExceededError") return "errors.database_quota";
  return "errors.database_generic";
}

export default function DatabaseGate({ children }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
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

    db.open()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((openError) => {
        if (!cancelled) setError(openError);
      });

    return () => {
      cancelled = true;
      if (reportDatabaseError === setError) reportDatabaseError = null;
    };
  }, []);

  if (error) {
    return (
      <ErrorScreen
        title={t("errors.database_title")}
        message={t(databaseErrorKey(error))}
        details={String(error?.stack || error?.message || error)}
        reloadLabel={t("errors.reload")}
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
