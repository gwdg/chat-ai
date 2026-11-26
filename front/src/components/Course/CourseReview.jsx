import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import SandboxedHtmlPreview from "../Others/SandboxedHtmlPreview";
import { loadCourseDocument } from "../../utils/courseCatalog";

/**
 * The lecturer view. It embeds the course's own review pages — self-contained
 * HTML files that render through inline JavaScript and show the solutions —
 * and repeats the coverage gaps the course data carries (draft questions,
 * missing explanations, skills without a self-learning page).
 */
export default function CourseReview({ course, tab = "skills" }) {
  const { t } = useTranslation();
  const url = tab === "quiz" ? course.overviews.quiz : course.overviews.skills;
  const [doc, setDoc] = useState({ status: "idle", html: "", error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!url) {
      setDoc({ status: "missing", html: "", error: null });
      return undefined;
    }
    let cancelled = false;
    setDoc({ status: "loading", html: "", error: null });
    loadCourseDocument(url)
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
  }, [url, reloadKey]);

  const stats = course.stats;

  return (
    <div data-guide="course-review" className="flex flex-col gap-4">
      <p className="rounded-xl border border-warning/40 bg-warning/5 px-3 py-2 text-xs leading-relaxed text-base-content/80">
        {t("course.review.description")}
      </p>

      <section className="rounded-xl border border-base-300 bg-base-100 p-4">
        <h3 className="text-sm font-semibold text-base-content">
          {t("course.review.coverage")}
        </h3>
        <ul className="mt-2 flex flex-col gap-1 text-xs leading-relaxed text-base-content/70">
          <li>
            {t("course.review.skills_with_lernseite", {
              with: stats.skillsWithLernseite,
              total: stats.skills,
            })}
          </li>
          <li>
            {t("course.review.questions_by_type", {
              single: stats.byType.single_choice,
              multiple: stats.byType.multiple_choice,
              open: stats.byType.open_end,
            })}
          </li>
          {stats.drafts > 0 && (
            <li>{t("course.review.drafts", { n: stats.drafts })}</li>
          )}
          {stats.withExplanation === 0 && stats.questions > 0 && (
            <li>{t("course.review.no_explanations")}</li>
          )}
        </ul>
      </section>

      {doc.status === "missing" && (
        <p className="text-sm text-base-content/70">{t("course.review.missing")}</p>
      )}

      {doc.status === "loading" && (
        <div className="flex items-center justify-center rounded-xl border border-base-300 py-12">
          <span className="loading loading-spinner loading-md" />
          <span className="sr-only">{t("course.review.loading")}</span>
        </div>
      )}

      {doc.status === "error" && (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-error/40 bg-error/5 px-4 py-3">
          <p className="text-sm text-error">{t("course.review.load_error")}</p>
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
          key={url}
          content={doc.html}
          title={t(
            tab === "quiz"
              ? "course.tab_quiz_review"
              : "course.tab_skills_review",
          )}
          relaxedByDefault
          showModeToggle={false}
        />
      )}
    </div>
  );
}
