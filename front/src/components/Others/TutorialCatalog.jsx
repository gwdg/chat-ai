import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Book, ChevronRight, Search, StarFilled } from "@carbon/icons-react";

import {
  FEATURE_CATEGORIES,
  featureGuides,
} from "../../config/featureGuides";
import { selectCompletedTutorials } from "../../Redux/reducers/interfaceSettingsSlice";
import { useFeatureGuide } from "../../context/FeatureGuideContext";
import { isAgentsEnabled } from "../../utils/modules";

export default function TutorialCatalog({ open: controlledOpen, onOpenChange }) {
  const { t } = useTranslation();
  const { startGuide } = useFeatureGuide();
  const completed = useSelector(selectCompletedTutorials);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState("");
  const [hideCompleted, setHideCompleted] = useState(true);

  const normalizedQuery = query.trim().toLowerCase();

  const grouped = useMemo(() => {
    return Object.entries(FEATURE_CATEGORIES)
      .map(([category, ids]) => ({
        category,
        ids: ids.filter((id) => {
          const guide = featureGuides[id];
          if (!guide) return false;
          if (id === "remote_agents" && !isAgentsEnabled()) return false;
          if (hideCompleted && completed.includes(id)) return false;
          if (!normalizedQuery) return true;
          return t(guide.titleKey).toLowerCase().includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.ids.length > 0);
  }, [normalizedQuery, t, hideCompleted, completed]);

  const start = (featureId) => {
    startGuide(featureId);
    setOpen(false);
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className="btn btn-accent btn-xs gap-1"
        data-guide="browse-tutorials"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Book size={12} aria-hidden="true" />
        {t("feature_guide.catalog.open")}
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
                placeholder={t("feature_guide.catalog.search")}
                aria-label={t("feature_guide.catalog.search")}
                className="input input-sm w-full pl-8"
              />
            </div>
            <label
              className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] font-medium text-base-content/70"
              title={t("feature_guide.catalog.hide_completed")}
            >
              <input
                type="checkbox"
                className="checkbox checkbox-xs"
                checked={hideCompleted}
                onChange={(event) => setHideCompleted(event.target.checked)}
                aria-label={t("feature_guide.catalog.hide_completed")}
              />
              <StarFilled
                size={12}
                className="text-warning"
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">
                {t("feature_guide.catalog.hide_completed")}
              </span>
            </label>
          </div>

          <div className="mt-2 max-h-64 overflow-y-auto pr-1">
            {grouped.length === 0 && (
              <p className="px-2 py-3 text-xs text-base-content/60">
                {t("feature_guide.catalog.empty")}
              </p>
            )}

            {grouped.map((group) => (
              <div key={group.category} className="mb-2 last:mb-0">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/60">
                  {t(`feature_guide.categories.${group.category}`)}
                </p>
                <div className="flex flex-col">
                  {group.ids.map((featureId) => {
                    const guide = featureGuides[featureId];
                    const isCompleted = completed.includes(featureId);
                    return (
                      <button
                        key={featureId}
                        type="button"
                        onClick={() => start(featureId)}
                        title={
                          isCompleted
                            ? `${t(
                                "feature_guide.catalog.completed_successfully",
                              )} — ${t("feature_guide.catalog.replay")}`
                            : t("feature_guide.catalog.start")
                        }
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-base-200"
                      >
                        {isCompleted && (
                          <StarFilled
                            size={14}
                            className="shrink-0 text-warning"
                            aria-label={t(
                              "feature_guide.catalog.completed_successfully",
                            )}
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {t(guide.titleKey)}
                        </span>
                        <ChevronRight
                          size={14}
                          className="shrink-0 text-base-content/40"
                          aria-hidden="true"
                        />
                      </button>
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
