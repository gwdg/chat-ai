import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Archive, Database, Download, RefreshCw, Trash2 } from "lucide-react";

import { useModal } from "../ModalContext";
import { useToast } from "../../hooks/useToast";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";
import ImportChatButton from "../../components/Sidebar/Buttons/ImportChatButton";
import { downloadLocalData } from "../../utils/dataExport";
import { isSyncEnabled } from "../../utils/modules";
import StorageStatus from "./StorageStatus";
import BackupSettings from "./BackupSettings";
import SyncSettings from "./SyncSettings";

/**
 * The Data tab is one screen per concern instead of one long scroll: local data
 * management, the downloadable encrypted backup, and the encrypted server
 * synchronization. The latter is only offered while the sync module is on, so a
 * deployment without it shows two sections.
 */

const DATA_SECTIONS = [
  {
    id: "manage",
    icon: Database,
    labelKey: "user_settings.data.sections.manage",
  },
  {
    id: "backup",
    icon: Archive,
    labelKey: "user_settings.data.sections.backup",
  },
  {
    id: "sync",
    icon: RefreshCw,
    labelKey: "user_settings.data.sections.sync",
    syncOnly: true,
  },
];

export default function DataSettings({ userData, initialSection = null }) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { notifySuccess, notifyError } = useToast();
  const userSettings = useSelector(selectUserSettings);

  const sections = DATA_SECTIONS.filter(
    (section) => !section.syncOnly || isSyncEnabled(),
  );
  const resolveSection = (id) =>
    sections.some((section) => section.id === id) ? id : "manage";

  const [activeSection, setActiveSection] = useState(() =>
    resolveSection(initialSection),
  );

  useEffect(() => {
    setActiveSection(resolveSection(initialSection));
    // `sections` follows `isSyncEnabled()`, which is a build-time module flag
    // and cannot change while the modal is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection]);

  const handleExportData = async () => {
    try {
      await downloadLocalData({
        username: userData?.username,
        userSettings,
      });
      notifySuccess(t("user_settings.data.export_success"));
    } catch (error) {
      console.error("Failed to export local data", error);
      notifyError(t("user_settings.data.export_error"));
    }
  };

  const renderSection = () => {
    if (activeSection === "backup") {
      return (
        <div data-guide="data-section-backup">
          <BackupSettings />
        </div>
      );
    }

    if (activeSection === "sync" && isSyncEnabled()) {
      return (
        <div data-guide="data-section-sync">
          <SyncSettings />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-5" data-guide="data-section-manage">
        <p className="text-xs leading-relaxed text-base-content/70">
          {t("user_settings.data.description")}
        </p>
        <StorageStatus />
        <div className="grid gap-3 sm:grid-cols-3">
          <ImportChatButton variant={"userData"} />
          <button
            type="button"
            onClick={handleExportData}
            className="btn w-full"
            data-guide="export-data"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {t("user_settings.export_data_button")}
          </button>
          <button
            type="button"
            onClick={() => openModal("clearCache")}
            className="btn btn-error btn-outline"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t("user_settings.clear_data_button")}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label={t("user_settings.data.sections.label")}
        className="flex flex-wrap gap-1 rounded-xl bg-base-200 p-1"
      >
        {sections.map((section) => {
          const Icon = section.icon;
          const selected = section.id === activeSection;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={selected}
              data-guide={`data-subtab-${section.id}`}
              onClick={() => setActiveSection(section.id)}
              className={`flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:flex-none sm:justify-start ${
                selected
                  ? "bg-base-100 text-accent shadow-sm"
                  : "text-base-content/70 hover:bg-base-100/70 hover:text-base-content"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t(section.labelKey)}</span>
            </button>
          );
        })}
      </div>
      {renderSection()}
    </div>
  );
}
