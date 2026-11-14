import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HardDrive } from "lucide-react";

import { formatBytes } from "../../utils/formatBytes";
import {
  getStorageStatus,
  requestPersistentStorage,
} from "../../utils/storagePersistence";

export default function StorageStatus() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [requesting, setRequesting] = useState(false);

  const refresh = useCallback(async () => {
    setStatus(await getStorageStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const request = async () => {
    setRequesting(true);
    try {
      await requestPersistentStorage();
      await refresh();
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="rounded-xl border border-base-300 bg-base-200/50 p-4">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-base-content/70" />
        <h3 className="text-sm font-medium text-base-content">
          {t("user_settings.data.storage_title")}
        </h3>
      </div>
      {!status ? (
        <p className="mt-2 text-xs text-base-content/70">{t("common.loading")}</p>
      ) : !status.supported ? (
        <p className="mt-2 text-xs text-base-content/70">
          {t("user_settings.data.storage_unavailable")}
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-2 text-xs leading-relaxed text-base-content/80">
          <p>
            {status.persisted
              ? t("user_settings.data.storage_persisted")
              : t("user_settings.data.storage_not_persisted")}
          </p>
          {typeof status.usage === "number" && typeof status.quota === "number" ? (
            <p>
              {t("user_settings.data.storage_usage", {
                used: formatBytes(status.usage),
                quota: formatBytes(status.quota),
              })}
            </p>
          ) : null}
          {!status.persisted ? (
            <button
              type="button"
              onClick={request}
              disabled={requesting}
              className="btn btn-sm btn-outline w-fit"
            >
              {requesting
                ? t("user_settings.data.storage_requesting")
                : t("user_settings.data.storage_request")}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
