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
            className="text-sm font-medium text-base-content"
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
            className="btn btn-ghost btn-xs btn-square text-accent"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-base-content/70">
          {t("user_settings.chat_preferences.memory.description")}
        </p>
      </div>

      <div
        role="group"
        aria-labelledby="global-memory-mode-label"
        className="tabs tabs-box tabs-sm grid grid-cols-3"
      >
        {MEMORY_OPTIONS.map((option) => {
          const selected = option.value === memoryMode;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => dispatch(setMemoryMode(option.value))}
              className={`tab min-w-0 text-xs font-medium ${selected ? "tab-active text-accent!" : ""}`}
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
        className="text-xs text-base-content/70"
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
        <h3 className="text-sm font-medium text-base-content">
          {t("user_settings.chat_preferences.suggestions.section_label")}
        </h3>
        <button
          type="button"
          onClick={() => openModal("helpChoiceProposer")}
          aria-label={t(
            "user_settings.chat_preferences.suggestions.help_label",
          )}
          title={t("user_settings.chat_preferences.suggestions.help_label")}
          className="btn btn-ghost btn-xs btn-square text-accent"
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
