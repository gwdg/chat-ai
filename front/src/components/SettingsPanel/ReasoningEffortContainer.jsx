// components/settings/ReasoningEffortContainer.jsx
import { Trans, useTranslation } from "react-i18next";
import { CircleHelp } from "lucide-react";
import { useModal } from "../../modals/ModalContext";
import { useDispatch, useSelector } from "react-redux";
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
        {/* <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400"> */}
          {/* {t("settings.reasoning_effort.subtitle")} */}
          {/* {t(`settings.reasoning_effort.options.${reasoningEffortOptions[reasoningEffortIndex]}.description`)} */}
        {/* </p> */}
      </div>

      <div
        role="group"
        aria-labelledby="global-reasoning-label"
        className={`grid min-h-10 grid-flow-col grid-rows-1 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/60`}
      >
        {reasoningEffortOptions.map((option, index) => {
          const selected = index === reasoningEffortIndex;
          return (
            <button
              key={index}
              type="button"
              aria-pressed={selected}
              onClick={() => dispatch(setReasoningEffort(index))}
              className={`min-w-0 rounded-md px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 ${
                selected
                  ? "bg-white text-tertiary shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-600 hover:bg-white/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/70 dark:hover:text-white"
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