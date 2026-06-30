import { useTranslation } from "react-i18next";

const EFFORT_OPTIONS = [
  { value: "low", labelKey: "settings.model_effort_low", dotClass: "h-3 w-3" },
  { value: "medium", labelKey: "settings.model_effort_medium", dotClass: "h-[18px] w-[18px]" },
  { value: "high", labelKey: "settings.model_effort_high", dotClass: "h-6 w-6" },
];

export default function ModelEffortSelector({ localState, setLocalState }) {
  const { t } = useTranslation();
  const selectedEffort = localState?.settings?.model_effort || "medium";

  const handleChangeEffort = (modelEffort) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        model_effort: modelEffort,
      },
      flush: true,
    }));
  };

  return (
    <div className="flex flex-row w-full md:items-center">
      <div className="flex-shrink-0 flex items-center gap-2 min-w-[80px]">
        <p className="text-sm font-medium">{t("settings.model_effort_label")}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 w-full select-none">
        {EFFORT_OPTIONS.map(({ value, labelKey, dotClass }) => {
          const isSelected = selectedEffort === value;

          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleChangeEffort(value)}
              className={[
                "h-[52px] rounded-lg border px-2",
                "flex flex-col items-center justify-center gap-1.5",
                "text-xs font-medium transition-all cursor-pointer",
                isSelected
                  ? "border-tertiary bg-sky-50 text-tertiary shadow-sm dark:bg-sky-950/40"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-border_dark dark:bg-bg_secondary_dark dark:text-gray-200 dark:hover:bg-gray-800",
              ].join(" ")}
            >
              <span className="flex h-6 items-center justify-center">
                <span
                  className={[
                    dotClass,
                    "rounded-full border transition-colors",
                    isSelected
                      ? "border-tertiary bg-tertiary"
                      : "border-gray-400 bg-gray-200 dark:border-gray-500 dark:bg-gray-600",
                  ].join(" ")}
                />
              </span>
              <span className="leading-none">{t(labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
