import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";

import SandboxedHtmlPreview from "../Others/SandboxedHtmlPreview";
import { loadCourseDocument } from "../../utils/courseCatalog";

/**
 * Self-learning pages of a course. The list and the preview share one pane;
 * a page is fetched as text and rendered in the shared sandboxed HTML preview,
 * which keeps the course HTML away from the app but lets its own JavaScript
 * build the interactive model.
 */
export default function CourseLernseiten({
  course,
  selectedUrl = "",
  onSelect,
}) {
  const { t } = useTranslation();
  const [doc, setDoc] = useState({ status: "idle", html: "", error: null });
  const [reloadKey, setReloadKey] = useState(0);

  const skillNames = useMemo(() => {
    const map = new Map();
    for (const skill of course.skillsDoc?.skills || []) {
      map.set(skill.key, skill.name);
    }
    return map;
  }, [course.skillsDoc]);

  const selected = course.lernseiten.find((entry) => entry.url === selectedUrl) || null;

  useEffect(() => {
    if (!selectedUrl) {
      setDoc({ status: "idle", html: "", error: null });
      return undefined;
    }
    let cancelled = false;
    setDoc({ status: "loading", html: "", error: null });
    loadCourseDocument(selectedUrl)
      .then((html) => {
        if (!cancelled) setDoc({ status: "ready", html, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setDoc({
            status: "error",
            html: "",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUrl, reloadKey]);

  if (course.lernseiten.length === 0) {
    return (
      <div
        data-guide="course-lernseiten"
        className="rounded-xl border border-dashed border-base-300 px-4 py-6 text-center text-sm text-base-content/70"
      >
        {t("course.lernseiten.empty")}
      </div>
    );
  }

  return (
    <div data-guide="course-lernseiten" className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-base-content">
          {t("course.lernseiten.title")}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-base-content/70">
          {t("course.lernseiten.description")}
        </p>
      </div>

      <ul className="flex flex-wrap gap-2">
        {course.lernseiten.map((entry) => {
          const active = entry.url === selectedUrl;
          return (
            <li key={entry.url}>
              <button
                type="button"
                className={`btn btn-sm gap-1 ${
                  active ? "btn-active" : "btn-ghost border border-base-300"
                }`}
                aria-pressed={active}
                onClick={() => onSelect?.(active ? "" : entry.url)}
              >
                <BookOpen size={14} aria-hidden="true" />
                {entry.title}
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-base-content">
                {selected.title}
              </p>
              <p className="text-xs text-base-content/60">
                {selected.skill
                  ? t("course.lernseiten.belongs_to", {
                      name: skillNames.get(selected.skill) || selected.skill,
                    })
                  : t("course.lernseiten.unknown_skill")}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => onSelect?.("")}
            >
              {t("course.lernseiten.close")}
            </button>
          </div>

          {doc.status === "loading" && (
            <div className="flex items-center justify-center rounded-xl border border-base-300 py-12">
              <span className="loading loading-spinner loading-md" />
              <span className="sr-only">{t("course.lernseiten.loading")}</span>
            </div>
          )}

          {doc.status === "error" && (
            <div className="flex flex-col items-start gap-2 rounded-xl border border-error/40 bg-error/5 px-4 py-3">
              <p className="text-sm text-error">{t("course.lernseiten.load_error")}</p>
              <p className="break-all text-xs text-base-content/60">{doc.error}</p>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setReloadKey((value) => value + 1)}
              >
                {t("course.retry")}
              </button>
            </div>
          )}

          {doc.status === "ready" && (
            <SandboxedHtmlPreview
              key={selected.url}
              content={doc.html}
              title={selected.title}
              relaxedByDefault
              showModeToggle={false}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-base-content/70">
          {t("course.lernseiten.pick")}
        </p>
      )}
    </div>
  );
}
