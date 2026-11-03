import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { ChevronDown, ChevronRight, Idea, Search, StarFilled } from "@carbon/icons-react";

import {
  USE_CASE_CATEGORIES,
  buildUseCaseGuide,
  useCases,
} from "../../config/useCases";
import { useFeatureGuide } from "../../context/FeatureGuideContext";
import { selectCompletedUseCases } from "../../Redux/reducers/interfaceSettingsSlice";

export default function UseCaseCatalog({ open: controlledOpen, onOpenChange }) {
  const { t } = useTranslation();
  const { startGuide, startCustomGuide } = useFeatureGuide();
  const completed = useSelector(selectCompletedUseCases);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [hideCompleted, setHideCompleted] = useState(true);

  const normalizedQuery = query.trim().toLowerCase();

  const grouped = useMemo(() => {
    return Object.entries(USE_CASE_CATEGORIES)
      .map(([category, ids]) => ({
        category,
        ids: ids.filter((id) => {
          const useCase = useCases[id];
          if (!useCase) return false;
          if (hideCompleted && completed.includes(id)) return false;
          if (!normalizedQuery) return true;
          const text = `${t(`use_cases.${id}.title`)} ${t(
            `use_cases.${id}.description`,
          )}`;
          return text.toLowerCase().includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.ids.length > 0);
  }, [normalizedQuery, t, hideCompleted, completed]);

  const startTutorial = (tutorialId) => {
    startGuide(tutorialId);
    setOpen(false);
  };

  const startWalkthrough = (useCaseId) => {
    const guide = buildUseCaseGuide(useCaseId);
    if (!guide) return;
    startCustomGuide(guide);
    setOpen(false);
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className="btn btn-accent btn-xs gap-1"
        data-guide="browse-use-cases"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Idea size={12} aria-hidden="true" />
        {t("use_cases.catalog.open")}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(90vw,32rem)] rounded-xl border border-base-300 bg-base-100 p-2 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[10rem] flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/50"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("use_cases.catalog.search")}
                aria-label={t("use_cases.catalog.search")}
                className="input input-sm w-full pl-8"
              />
            </div>
            <label
              className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] font-medium text-base-content/70"
              title={t("use_cases.catalog.hide_completed")}
            >
              <input
                type="checkbox"
                className="checkbox checkbox-xs"
                checked={hideCompleted}
                onChange={(event) => setHideCompleted(event.target.checked)}
                aria-label={t("use_cases.catalog.hide_completed")}
              />
              <StarFilled
                size={12}
                className="text-warning"
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">
                {t("use_cases.catalog.hide_completed")}
              </span>
            </label>
          </div>

          <div className="mt-2 max-h-72 overflow-y-auto pr-1">
            {grouped.length === 0 && (
              <p className="px-2 py-3 text-xs text-base-content/60">
                {t("use_cases.catalog.empty")}
              </p>
            )}

            {grouped.map((group) => (
              <div key={group.category} className="mb-2 last:mb-0">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/60">
                  {t(`use_cases.categories.${group.category}`)}
                </p>

                <div className="flex flex-col gap-1">
                  {group.ids.map((useCaseId) => {
                    const useCase = useCases[useCaseId];
                    const expanded = expandedId === useCaseId;
                    const isCompleted = completed.includes(useCaseId);
                    const Icon = expanded ? ChevronDown : ChevronRight;

                    return (
                      <div
                        key={useCaseId}
                        className="rounded-lg border border-base-300/70"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(expanded ? null : useCaseId)
                          }
                          title={
                            isCompleted
                              ? t(
                                  "use_cases.catalog.completed_successfully",
                                )
                              : undefined
                          }
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-base-200"
                          aria-expanded={expanded}
                        >
                          {isCompleted && (
                            <StarFilled
                              size={14}
                              className="shrink-0 text-warning"
                              aria-label={t(
                                "use_cases.catalog.completed_successfully",
                              )}
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {t(`use_cases.${useCaseId}.title`)}
                          </span>
                          <Icon
                            size={14}
                            className="shrink-0 text-base-content/50"
                            aria-hidden="true"
                          />
                        </button>

                        {expanded && (
                          <div className="border-t border-base-300/70 px-2 py-2">
                            <p className="text-xs leading-relaxed text-base-content/70">
                              {t(`use_cases.${useCaseId}.description`)}
                            </p>
                            {isCompleted && (
                              <p className="mt-1 flex items-center gap-1 text-success">
                                <StarFilled
                                  size={12}
                                  className="shrink-0 text-warning"
                                  aria-hidden="true"
                                />
                                {t(
                                  "use_cases.catalog.completed_successfully",
                                )}
                              </p>
                            )}
                            <button
                              type="button"
                              className="btn btn-accent btn-xs mt-2"
                              onClick={() => startWalkthrough(useCaseId)}
                            >
                              {isCompleted
                                ? t(
                                    "use_cases.catalog.walk_through_again",
                                  )
                                : t("use_cases.catalog.start_walkthrough")}
                            </button>
                            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-base-content/80">
                              {useCase.steps.map((step, index) => (
                                <li key={index}>
                                  <span>{t(step.textKey)}</span>
                                  {step.tutorialId && (
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-xs ml-1"
                                      onClick={() =>
                                        startTutorial(step.tutorialId)
                                      }
                                    >
                                      {t(
                                        "use_cases.catalog.show_tutorial",
                                      )}
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
