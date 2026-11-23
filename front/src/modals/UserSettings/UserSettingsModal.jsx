import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Brain,
  ChartColumn,
  Database,
  Lock,
  Settings2,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";

import BaseModal from "../BaseModal";
import DefaultModelSelector from "./DefaultModelSelector";
import ProfileSettings from "./ProfileSettings";
import TimeoutSetter from "./TimeoutSetter";
import UserMemoryContainer from "./UserMemoryContainer";
import {
  AdvancedModePreference,
  ConversationSummaryPreference,
  DocumentConversionPreference,
  McpToolPolicyPreference,
  MemoryPreference,
  MessageDisplayPreference,
  RenderingPreferences,
  SubmissionPreference,
  SuggestionPreference,
} from "./ChatPreferences";
import DataSettings from "./DataSettings";
import UsageSettings from "./UsageSettings";
import EncryptionSettings from "./EncryptionSettings";
import BrandConsentSettings from "./BrandConsentSettings";
import { isChoicesEnabled, isToolsEnabled } from "../../utils/modules";
import { isFeatureEnabled } from "../../config/deployment";

const PROFILE_TABS = [
  {
    id: "profile",
    icon: UserRound,
    labelKey: "user_settings.tabs.profile.label",
    titleKey: "user_settings.tabs.profile.title",
    descriptionKey: "user_settings.tabs.profile.description",
  },
  {
    id: "usage",
    icon: ChartColumn,
    labelKey: "user_settings.tabs.usage.label",
    titleKey: "user_settings.usage.title",
    descriptionKey: "user_settings.usage.description",
  },
  {
    id: "chat",
    icon: SlidersHorizontal,
    labelKey: "user_settings.tabs.chat.label",
    titleKey: "user_settings.tabs.chat.title",
    descriptionKey: "user_settings.tabs.chat.description",
  },
  {
    id: "advanced",
    icon: Settings2,
    labelKey: "user_settings.tabs.advanced.label",
    titleKey: "user_settings.tabs.advanced.title",
    descriptionKey: "user_settings.tabs.advanced.description",
  },
  {
    id: "memories",
    icon: Brain,
    labelKey: "user_settings.tabs.memories.label",
    titleKey: "user_settings.tabs.memories.title",
    descriptionKey: "user_settings.tabs.memories.description",
  },
  {
    id: "encryption",
    icon: Lock,
    labelKey: "user_settings.tabs.encryption.label",
    titleKey: "user_settings.tabs.encryption.title",
    descriptionKey: "user_settings.tabs.encryption.description",
  },
  {
    id: "data",
    icon: Database,
    labelKey: "user_settings.tabs.data.label",
    titleKey: "user_settings.tabs.data.title",
    descriptionKey: "user_settings.tabs.data.description",
  },
];

const DATA_SUBSECTIONS = new Set(["manage", "backup", "sync"]);
const PROFILE_SUBSECTIONS = new Set(["user", "institution"]);

/**
 * `"data"` opens the Data tab; `"data/backup"` also picks a section. The Profile
 * tab works the same way (`"profile/institution"`), so a link can land on the
 * institution screen directly.
 */
const parseInitialTab = (tab) => {
  if (typeof tab !== "string") return { tab: null, section: null };
  const [section, sub] = tab.split("/");
  if (!sub) return { tab: section, section: null };
  if (section === "data") {
    return { tab: "data", section: DATA_SUBSECTIONS.has(sub) ? sub : null };
  }
  if (section === "profile") {
    return {
      tab: "profile",
      section: PROFILE_SUBSECTIONS.has(sub) ? sub : null,
    };
  }
  return { tab: section, section: null };
};

export default function UserSettingsModal({
  isOpen,
  onClose,
  userData,
  modelsData,
  localState,
  initialTab = null,
}) {
  const { t } = useTranslation();
  const choicesModule = isChoicesEnabled();
  const availableTabs = PROFILE_TABS.filter(
    (tab) => tab.id !== "encryption" || isFeatureEnabled("e2ee"),
  );
  const resolveTab = (tab) =>
    availableTabs.some((entry) => entry.id === tab) ? tab : "profile";
  const initialSelection = parseInitialTab(initialTab);
  const [activeTab, setActiveTab] = useState(() =>
    resolveTab(initialSelection.tab),
  );
  // The active tab's own section, if it has one: Profile (`user`/`institution`)
  // or Data (`manage`/`backup`/`sync`). Each screen ignores a value that is not
  // one of its own, so one state is enough for both.
  const [section, setSection] = useState(initialSelection.section);
  const [highlightActiveTab, setHighlightActiveTab] = useState(false);
  const activeTabConfig =
    availableTabs.find((tab) => tab.id === activeTab) ?? availableTabs[0];

  useEffect(() => {
    if (!isOpen) return undefined;
    const selection = parseInitialTab(initialTab);
    setActiveTab(resolveTab(selection.tab));
    setSection(selection.section);
    setHighlightActiveTab(Boolean(initialTab));
    if (!initialTab) return undefined;
    const timer = setTimeout(() => setHighlightActiveTab(false), 1800);
    return () => clearTimeout(timer);
  }, [isOpen, initialTab]);

  const renderTabContent = () => {
    if (activeTab === "profile") {
      return (
        <ProfileSettings
          userData={userData}
          modelsData={modelsData}
          initialSection={section}
        />
      );
    }

    if (activeTab === "usage") {
      return <UsageSettings userData={userData} />;
    }

    if (activeTab === "advanced") {
      return (
        <div className="flex flex-col gap-5">
          <AdvancedModePreference />
          {isToolsEnabled() && (
            <div className="border-t border-base-300 pt-5">
              <McpToolPolicyPreference />
            </div>
          )}
          <div className="border-t border-base-300 pt-5" data-guide="rendering-preference">
            <RenderingPreferences />
          </div>
          <BrandConsentSettings />
        </div>
      );
    }

    if (activeTab === "chat") {
      return (
        <div className="flex flex-col gap-5">
          {modelsData ? (
            <DefaultModelSelector modelsData={modelsData} />
          ) : (
            <p className="text-sm text-base-content/70">
              {t("common.loading")}
            </p>
          )}
          <div data-guide="submission-preference">
            <SubmissionPreference />
          </div>
          <ConversationSummaryPreference />
          <MessageDisplayPreference />
          <div data-guide="document-conversion-preference">
            <DocumentConversionPreference />
          </div>
          {choicesModule && <SuggestionPreference />}
          <TimeoutSetter />
        </div>
      );
    }

    if (activeTab === "memories") {
      return (
        <div className="flex flex-col gap-5">
          <MemoryPreference />
          <div className="border-t border-base-300 pt-5">
            <UserMemoryContainer localState={localState} />
          </div>
        </div>
      );
    }

    if (activeTab === "encryption" && isFeatureEnabled("e2ee")) {
      return <EncryptionSettings modelsData={modelsData} />;
    }

    if (activeTab === "data") {
      return (
        <DataSettings userData={userData} initialSection={section} />
      );
    }

    return null;
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="user_settings.title"
      maxWidth="max-w-5xl"
      contentClassName="min-h-0 p-0"
    >
      <div className="flex h-[min(72dvh,650px)] min-h-0 flex-col overflow-hidden border-t border-base-300 md:flex-row">
        <nav
          aria-label={t("user_settings.tabs.navigation_label")}
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-base-300 bg-base-200 p-2 md:w-56 md:flex-col md:overflow-y-auto md:border-r md:border-b-0 md:p-3"
        >
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={selected}
                data-guide={`settings-tab-${tab.id}`}
                className={`flex min-h-10 min-w-max items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 md:w-full ${
                  selected
                    ? "bg-base-100 text-accent shadow-sm"
                    : "text-base-content/70 hover:bg-base-100/70 hover:text-base-content"
                } ${
                  selected && highlightActiveTab
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-base-200"
                    : ""
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
          className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-base-100"
        >
          <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
            <header className="border-b border-base-300 pb-4">
              <h2 className="text-base font-semibold text-base-content">
                {t(activeTabConfig.titleKey)}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-base-content/70">
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
