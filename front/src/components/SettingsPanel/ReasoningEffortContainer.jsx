// components/settings/ReasoningEffortContainer.jsx
import { useTranslation } from "react-i18next";
import { CircleHelp } from "lucide-react";
import { useModal } from "../../modals/ModalContext";
import { useDispatch } from "react-redux";
import getModelDefaults from "../../config/getModelDefaults";

const ReasoningEffortContainer = ({ localState, setLocalState }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const settings = localState?.settings || {};
  const modelDefaults = getModelDefaults(settings?.model?.id);
  const showReasoningEffort = modelDefaults?.reasoning_effort !== undefined && modelDefaults?.reasoning_effort !== null ? true : false;
  const reasoningEffortIndex = settings?.reasoning_effort !== undefined && settings?.reasoning_effort !== null ? settings.reasoning_effort : modelDefaults?.reasoning_effort || 0;
  const reasoningEffortOptions = modelDefaults?.reasoning_options || ["none"];

  // Simple setter for per-tool flags
  const setReasoningEffort = (reasoningEffort) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        reasoning_effort: reasoningEffort,
      },
      flush: true,
    }));
  };

  return showReasoningEffort && (
    <section className="flex flex-col gap-2">
      <div className="min-w-0">
        <div className="flex-shrink-0 flex items-center gap-2 min-w-[80px]">
          <p className="text-sm font-medium">{t("settings.reasoning_effort.title")}</p>
          <CircleHelp
            className="h-[16px] w-[16px] cursor-pointer text-[#009EE0]"
            alt="help"
            onClick={() => openModal("helpReasoning")}
          />
        </div>
      </div>

      <div
        role="group"
        aria-labelledby="global-reasoning-label"
        className={`grid min-h-10 gap-1 rounded-lg border border-base-300 bg-base-200 p-1 ${
          reasoningEffortOptions?.length <= 5
            ? "grid-flow-col grid-rows-1"
            : reasoningEffortOptions?.length <= 6
                ? "grid-flow-row grid-cols-3"
                : "grid-flow-row grid-cols-4"
        }`}
      >
        {reasoningEffortOptions.map((option, index) => {
          const selected = index === reasoningEffortIndex;
          return (
            <button
              key={index}
              type="button"
              aria-pressed={selected}
              onClick={() => dispatch(setReasoningEffort(index))}
              className={`min-w-0 rounded-md px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                selected
                  ? "bg-base-100 text-accent shadow-sm dark:text-white"
                  : "text-base-content/70 hover:bg-white/70 hover:text-base-content dark:hover:bg-gray-700/70"
              }`}
            >
              <span className="block truncate">
                {t(`settings.reasoning_effort.options.${option}.label`)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default ReasoningEffortContainer;