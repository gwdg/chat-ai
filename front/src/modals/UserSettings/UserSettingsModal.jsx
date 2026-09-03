import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  Brain,
  Database,
  Download,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";

import { useModal } from "../ModalContext";
import BaseModal from "../BaseModal";
import DefaultModelSelector from "./DefaultModelSelector";
import UserInfoContainer from "./UserInfoContainer";
import TimeoutSetter from "./TimeoutSetter";
import UserMemoryContainer from "./UserMemoryContainer";
import {
  MemoryPreference,
  SuggestionPreference,
} from "./ChatPreferences";
import { getExportData } from "../../utils/conversationUtils";
import { useToast } from "../../hooks/useToast";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";
import ImportChatButton from "../../components/Sidebar/Buttons/ImportChatButton";

const PROFILE_TABS = [
  {
    id: "profile",
    icon: UserRound,
    labelKey: "user_settings.tabs.profile.label",
    titleKey: "user_settings.tabs.profile.title",
    descriptionKey: "user_settings.tabs.profile.description",
  },
  {
    id: "chat",
    icon: SlidersHorizontal,
    labelKey: "user_settings.tabs.chat.label",
    titleKey: "user_settings.tabs.chat.title",
    descriptionKey: "user_settings.tabs.chat.description",
  },
  {
    id: "memories",
    icon: Brain,
    labelKey: "user_settings.tabs.memories.label",
    titleKey: "user_settings.tabs.memories.title",
    descriptionKey: "user_settings.tabs.memories.description",
  },
  {
    id: "data",
    icon: Database,
    labelKey: "user_settings.tabs.data.label",
    titleKey: "user_settings.tabs.data.title",
    descriptionKey: "user_settings.tabs.data.description",
  },
];

const generateFileName = (extension, username = "user") => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${username}-chat-ai-${year}${month}${day}-${hour}${minute}${second}.${extension}`;
};

export default function UserSettingsModal({
  isOpen,
  onClose,
  userData,
  modelsData,
  localState,
}) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { notifySuccess, notifyError } = useToast();
  const userSettings = useSelector(selectUserSettings);
  const choicesModule = import.meta.env.VITE_MODULE_CHOICES === "true";
  const [activeTab, setActiveTab] = useState("profile");
  const activeTabConfig =
    PROFILE_TABS.find((tab) => tab.id === activeTab) ?? PROFILE_TABS[0];

  useEffect(() => {
    if (isOpen) setActiveTab("profile");
  }, [isOpen]);

  const handleExportData = async () => {
    try {
      const exportData = await getExportData();
      exportData.user_settings = userSettings;
      const content = JSON.stringify(exportData, null, 2);
      const file = new Blob([content], { type: "application/json" });
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(file);
      link.download = generateFileName("json", userData?.username);
      link.href = objectUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      notifySuccess(t("user_settings.data.export_success"));
    } catch (error) {
      console.error("Failed to export local data", error);
      notifyError(t("user_settings.data.export_error"));
    }
  };

  const renderTabContent = () => {
    if (activeTab === "profile") {
      return userData ? (
        <UserInfoContainer userData={userData} />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("common.loading")}
        </p>
      );
    }

    if (activeTab === "chat") {
      return (
        <div className="flex flex-col gap-5">
          {modelsData ? (
            <DefaultModelSelector modelsData={modelsData} />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("common.loading")}
            </p>
          )}
          {choicesModule && (
            <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
              <SuggestionPreference />
            </div>
          )}
          <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
            <TimeoutSetter />
          </div>
        </div>
      );
    }

    if (activeTab === "memories") {
      return (
        <div className="flex flex-col gap-5">
          <MemoryPreference />
          <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
            <UserMemoryContainer localState={localState} />
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {t("user_settings.data.title")}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {t("user_settings.data.description")}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <ImportChatButton
            variant={"userData"}
          />
          <button
            type="button"
            onClick={handleExportData}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {t("user_settings.export_data_button")}
          </button>
          <button
            type="button"
            onClick={() => openModal("clearCache")}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 dark:border-red-900/70 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t("user_settings.clear_data_button")}
          </button>
        </div>
      </div>
    );
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="user_settings.title"
      maxWidth="max-w-5xl"
      contentClassName="min-h-0 p-0"
    >
      <div className="flex h-[min(72dvh,650px)] min-h-0 flex-col overflow-hidden border-t border-gray-200 dark:border-gray-700 md:flex-row">
        <nav
          aria-label={t("user_settings.tabs.navigation_label")}
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900 md:w-56 md:flex-col md:overflow-y-auto md:border-r md:border-b-0 md:p-3"
        >
          {PROFILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={selected}
                className={`flex min-h-10 min-w-max items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 md:w-full ${
                  selected
                    ? "bg-white text-tertiary shadow-sm dark:bg-gray-800 dark:text-white"
                    : "text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/70 dark:hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <section
          key={activeTab}
          aria-label={t(activeTabConfig.titleKey)}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white dark:bg-bg_dark"
        >
          <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
            <header className="border-b border-gray-200 pb-4 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t(activeTabConfig.titleKey)}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {t(activeTabConfig.descriptionKey)}
              </p>
            </header>
            <div className="pt-5">{renderTabContent()}</div>
          </div>
        </section>
      </div>
    </BaseModal>
  );
}
