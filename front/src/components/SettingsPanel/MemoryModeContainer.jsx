import { Brain, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { selectMemoryMode } from "../../Redux/reducers/userSettingsReducer";
import { useModal } from "../../modals/ModalContext";

const MEMORY_MODE_OPTIONS = [
  { value: "default", key: "default" },
  { value: 0, key: "none" },
  { value: 1, key: "recall" },
  { value: 2, key: "learn" },
];

const GLOBAL_MEMORY_KEYS = ["none", "recall", "learn"];

export default function MemoryModeContainer({ localState, setLocalState }) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const globalMemoryMode = useSelector(selectMemoryMode);
  const globalKey = GLOBAL_MEMORY_KEYS[globalMemoryMode] ?? "none";

  const rawValue = localState?.settings?.memory_mode_override;
  const currentValue =
    rawValue === undefined || rawValue === null ? "default" : rawValue;
  const normalizedValue =
    currentValue === "default" ? "default" : Number(currentValue);
  const selectedOption =
    MEMORY_MODE_OPTIONS.find((option) => option.value === normalizedValue) ??
    MEMORY_MODE_OPTIONS[0];

  const description =
    selectedOption.value === "default"
      ? t("settings.memory_mode.options.default.description", {
          mode: t(
            `user_settings.chat_preferences.memory.options.${globalKey}.label`,
          ),
        })
      : t(
          `settings.memory_mode.options.${selectedOption.key}.description`,
        );

  return (
    <section className="flex flex-col gap-2">
      <div className="min-w-0">
        <div
          className="flex items-center gap-1.5"
          title={t("settings.memory_mode.description")}
        >
          <Brain
            className="h-4 w-4 shrink-0 text-tertiary"
            aria-hidden="true"
          />
          <h3
            id="conversation-memory-mode-label"
            className="text-sm font-medium text-tertiary"
          >
            {t("settings.memory_mode.label")}
          </h3>
          <button
            type="button"
            onClick={() => openModal("helpMemory")}
            aria-label={t("settings.memory_mode.description")}
            title={t("settings.memory_mode.description")}
            className="rounded-md p-1 text-tertiary transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 dark:hover:bg-gray-800"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        role="group"
        aria-labelledby="conversation-memory-mode-label"
        className="grid min-h-10 grid-cols-4 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/60"
      >
        {MEMORY_MODE_OPTIONS.map((option) => {
          const selected = option.value === normalizedValue;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                setLocalState((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    memory_mode_override: option.value,
                  },
                }))
              }
              className={`min-w-0 rounded-md px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 ${
                selected
                  ? "bg-white text-tertiary shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/70 dark:hover:text-white"
              }`}
            >
              <span className="block truncate">
                {t(`settings.memory_mode.options.${option.key}.label`)}
              </span>
            </button>
          );
        })}
      </div>

      <p
        className="text-xs text-gray-500 dark:text-gray-400"
        aria-live="polite"
      >
        {description}
      </p>
    </section>
  );
}
