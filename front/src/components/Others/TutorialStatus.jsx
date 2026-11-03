import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Checkmark, StarFilled } from "@carbon/icons-react";

import { useFeatureGuide } from "../../context/FeatureGuideContext";
import { suppressTutorial } from "../../Redux/reducers/interfaceSettingsSlice";

export default function TutorialStatus({ compact = false, onExpand }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const {
    isActive,
    activeGuide,
    activeStep,
    stepIndex,
    stepCount,
    stepComplete,
    stepGated,
    nextStep,
    previousStep,
    closeGuide,
    completion,
    completionGuide,
  } = useFeatureGuide();

  useEffect(() => {
    setDontShowAgain(false);
  }, [completion]);

  if (!isActive && !completion) return null;

  const guide = isActive ? activeGuide : completionGuide;
  if (!guide) return null;

  const completed = !isActive && Boolean(completion);
  const currentStep = (stepIndex ?? 0) + 1;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onExpand}
        title={`${t("feature_guide.status_title")} · ${t(guide.titleKey)}`}
        data-guide-keep-open
        className="flex w-10 flex-col items-center gap-1 rounded-xl p-1.5 hover:bg-base-200"
      >
        {completed ? (
          <Checkmark size={16} className="text-success" />
        ) : (
          <span className="text-[10px] font-semibold text-accent">
            {currentStep}/{stepCount}
          </span>
        )}
        <progress
          className="progress progress-accent h-1 w-8"
          value={completed ? stepCount : currentStep}
          max={stepCount || 1}
        />
      </button>
    );
  }

  return (
    <div
      className="mt-2 rounded-xl border border-accent/30 bg-base-100 p-2 text-xs shadow-sm"
      data-guide-keep-open
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-semibold text-base-content">
          {t("feature_guide.status_title")} · {t(guide.titleKey)}
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-xs shrink-0"
          onClick={closeGuide}
        >
          {t("feature_guide.close")}
        </button>
      </div>

      {completed ? (
        <>
          <p className="mt-1 flex items-center gap-1 font-medium text-success">
            <StarFilled
              size={14}
              className="shrink-0 text-warning"
              aria-label={t(
                "feature_guide.catalog.completed_successfully",
              )}
            />
            {t("feature_guide.status_done")}
          </p>
          {!completion?.isUseCase && (
            <label className="mt-2 flex items-center gap-2 text-base-content/70">
              <input
                type="checkbox"
                className="checkbox checkbox-xs"
                checked={dontShowAgain}
                onChange={(event) =>
                  setDontShowAgain(event.target.checked)
                }
              />
              {t("feature_guide.dont_show_again")}
            </label>
          )}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="btn btn-primary btn-xs"
              onClick={() => {
                if (dontShowAgain && completion) {
                  dispatch(suppressTutorial(completion.guideId));
                }
                closeGuide();
              }}
            >
              {t("feature_guide.done")}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-base-content/60">
            <span>
              {t("feature_guide.step", {
                current: currentStep,
                total: stepCount,
              })}
            </span>
            <span
              className={
                stepGated && !stepComplete
                  ? "font-medium text-warning"
                  : "font-medium text-success"
              }
            >
              {stepGated
                ? stepComplete
                  ? t("feature_guide.status_ready")
                  : t("feature_guide.status_waiting")
                : t("feature_guide.status_manual")}
            </span>
          </div>

          <progress
            className="progress progress-accent mt-1 w-full"
            value={currentStep}
            max={stepCount || 1}
          />

          {activeStep && (
            <p className="mt-1 leading-relaxed text-base-content/80">
              {t(activeStep.textKey)}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-1">
            {stepIndex > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={previousStep}
              >
                {t("feature_guide.back")}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-xs"
              onClick={nextStep}
              disabled={stepGated && !stepComplete}
            >
              {currentStep === stepCount
                ? t("feature_guide.done")
                : t("feature_guide.next")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
