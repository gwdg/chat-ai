import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import SandboxedHtmlPreview from "../../../../../components/Others/SandboxedHtmlPreview";
import {
  ensureCourse,
  loadCourseDocument,
} from "../../../../../utils/courseCatalog";
import {
  findCoursePage,
  pageSkillName,
  parsePageFence,
} from "./coursePagePrompt";

/**
 * A course learning page embedded in a chat reply.
 *
 * The fenced block carries only the course id and the page's file; the page and
 * its HTML always come from the course's own documents, so the model can neither
 * rewrite the page nor hand in HTML of its own. The page runs in the shared
 * sandboxed preview — the same one the course page uses — in relaxed mode,
 * because these pages build their body in JavaScript.
 */
export default function CoursePageBlock({ source }) {
  const { t } = useTranslation();
  const payload = useMemo(() => parsePageFence(source), [source]);
  const [state, setState] = useState({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!payload) {
      setState({ status: "invalid" });
      return () => {};
    }
    setState({ status: "loading" });
    ensureCourse(payload.course)
      .then(async (course) => {
        const page = findCoursePage(course, payload.page);
        if (cancelled) return;
        if (!page) {
          setState({ status: "missing" });
          return;
        }
        const html = await loadCourseDocument(page.url);
        if (!cancelled) setState({ status: "ready", course, page, html });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, [payload?.course, payload?.page, reloadKey]);

  if (state.status === "invalid") {
    return (
      <p
        className="my-2 text-xs text-base-content/60"
        data-guide="course-page-block"
      >
        {t("course.page_chat.block_error")}
      </p>
    );
  }

  if (state.status === "missing") {
    return (
      <p
        className="my-2 text-xs text-base-content/60"
        data-guide="course-page-block"
      >
        {t("course.page_chat.block_missing")}
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className="my-2 flex flex-wrap items-center gap-2"
        data-guide="course-page-block"
      >
        <p className="text-xs text-base-content/60">
          {t("course.page_chat.block_error")}
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => setReloadKey((value) => value + 1)}
        >
          {t("course.retry")}
        </button>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <p
        className="my-2 flex items-center gap-2 text-xs text-base-content/60"
        data-guide="course-page-block"
      >
        <span className="loading loading-spinner loading-xs" />
        {t("course.page_chat.block_loading")}
      </p>
    );
  }

  const skill = pageSkillName(state.course, state.page);

  return (
    <div
      className="my-3 flex flex-col gap-2"
      data-guide="course-page-block"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-base-content">
          {state.page.title}
        </p>
        {skill && (
          <p className="text-[11px] text-base-content/60">{skill}</p>
        )}
      </div>
      <SandboxedHtmlPreview
        key={state.page.url}
        content={state.html}
        title={state.page.title}
        relaxedByDefault
        showModeToggle={false}
        autoHeight
        heightClass="h-[26rem]"
      />
    </div>
  );
}
