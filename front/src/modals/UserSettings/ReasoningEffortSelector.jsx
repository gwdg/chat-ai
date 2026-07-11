import { Trans, useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import { selectReasoningEffort, setReasoningEffort } from "../../Redux/reducers/userSettingsReducer";

// Flip this to false once the model list exposes a `supportsReasoningEffort` key.
const MODEL_SUPPORTS_REASONING_EFFORT = true;

const EFFORT_OPTIONS = [
  {
    value: "off",
    labelKey: "user_settings.reasoning_effort.off",
    dotSize: null,
  },
  {
    value: "low",
    labelKey: "user_settings.reasoning_effort.low",
    dotSize: "h-2.5 w-2.5",
  },
  {
    value: "medium",
    labelKey: "user_settings.reasoning_effort.mid",
    dotSize: "h-[18px] w-[18px]",
  },
  {
    value: "high",
    labelKey: "user_settings.reasoning_effort.high",
    dotSize: "h-6 w-6",
  },
];

export default function ReasoningEffortSelector() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const selectedEffort = useSelector(selectReasoningEffort);

  if (!MODEL_SUPPORTS_REASONING_EFFORT) return null;

  const handleSelect = (value) => {
    dispatch(setReasoningEffort(value));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium dark:text-white">
          <Trans i18nKey="user_settings.reasoning_effort.title" />
        </p>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        <Trans i18nKey="user_settings.reasoning_effort.description" />
      </p>

      <div className="grid grid-cols-4 gap-2 select-none">
        {EFFORT_OPTIONS.map(({ value, labelKey, dotSize }) => {
          const isSelected = selectedEffort === value;
          const isOff = value === "off";

          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleSelect(value)}
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
                {isOff ? (
                  <span
                    className={[
                      "h-[3px] w-5 rounded-full transition-colors",
                      isSelected
                        ? "bg-tertiary"
                        : "bg-gray-300 dark:bg-gray-600",
                    ].join(" ")}
                  />
                ) : (
                  <span
                    className={[
                      dotSize,
                      "rounded-full border transition-colors",
                      isSelected
                        ? "border-tertiary bg-tertiary"
                        : "border-gray-400 bg-gray-200 dark:border-gray-500 dark:bg-gray-600",
                    ].join(" ")}
                  />
                )}
              </span>
              <span className="leading-none">{t(labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
