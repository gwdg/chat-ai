import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import {
  selectMemoryMode,
  selectSuggestUserPrompts,
  setMemoryMode,
  setSuggestUserPrompts,
} from "../../Redux/reducers/userSettingsReducer";
import { useModal } from "../ModalContext";
import ProfilePreferenceSwitch from "./ProfilePreferenceSwitch";

const MEMORY_OPTIONS = [
  { value: 0, key: "none" },
  { value: 1, key: "recall" },
  { value: 2, key: "learn" },
];

export function MemoryPreference() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const memoryMode = useSelector(selectMemoryMode);
  const selectedMemoryOption =
    MEMORY_OPTIONS.find((option) => option.value === memoryMode) ??
    MEMORY_OPTIONS[0];

  return (
    <section className="flex flex-col gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h3
            id="global-memory-mode-label"
            className="text-sm font-medium text-gray-900 dark:text-white"
          >
            {t("user_settings.chat_preferences.memory.label")}
          </h3>
          <button
            type="button"
            onClick={() => openModal("helpMemory")}
            aria-label={t(
              "user_settings.chat_preferences.memory.help_label",
            )}
            title={t("user_settings.chat_preferences.memory.help_label")}
            className="rounded-md p-1 text-tertiary transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 dark:hover:bg-gray-800"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {t("user_settings.chat_preferences.memory.description")}
        </p>
      </div>

      <div
        role="group"
        aria-labelledby="global-memory-mode-label"
        className="grid min-h-10 grid-cols-3 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/60"
      >
        {MEMORY_OPTIONS.map((option) => {
          const selected = option.value === memoryMode;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => dispatch(setMemoryMode(option.value))}
              className={`min-w-0 rounded-md px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 ${
                selected
                  ? "bg-white text-tertiary shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/70 dark:hover:text-white"
              }`}
            >
              <span className="block truncate">
                {t(
                  `user_settings.chat_preferences.memory.options.${option.key}.label`,
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p
        className="text-xs text-gray-500 dark:text-gray-400"
        aria-live="polite"
      >
        {t(
          `user_settings.chat_preferences.memory.options.${selectedMemoryOption.key}.description`,
        )}
      </p>
    </section>
  );
}

export function SuggestionPreference() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const suggestUserPrompts = useSelector(selectSuggestUserPrompts);

  return (
    <section>
      <div className="flex items-center gap-1.5 px-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          {t("user_settings.chat_preferences.suggestions.section_label")}
        </h3>
        <button
          type="button"
          onClick={() => openModal("helpChoiceProposer")}
          aria-label={t(
            "user_settings.chat_preferences.suggestions.help_label",
          )}
          title={t("user_settings.chat_preferences.suggestions.help_label")}
          className="rounded-md p-1 text-tertiary transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 dark:hover:bg-gray-800"
        >
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ProfilePreferenceSwitch
        label={t("user_settings.chat_preferences.suggestions.label")}
        description={t(
          "user_settings.chat_preferences.suggestions.description",
        )}
        checked={suggestUserPrompts}
        onChange={(checked) => dispatch(setSuggestUserPrompts(checked))}
      />
    </section>
  );
}
