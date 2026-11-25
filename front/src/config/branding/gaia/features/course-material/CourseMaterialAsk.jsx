import { useTranslation } from "react-i18next";
import { BookOpen, CircleHelp } from "lucide-react";

import { brandChatToolsFor } from "../../../../../utils/brandChatTools";
import { sendPrompt } from "../../../../../utils/promptSend";
import { COURSE_PAGE_TOOL } from "./coursePagePrompt";
import { COURSE_QUIZ_TOOL } from "./courseQuizPrompt";

/**
 * The course chat's ask row: one line naming what the tutor can show, plus one
 * button per tool that asks for an example of it. Each button appears only when
 * the tool it asks for is actually part of this chat's tool set, and the row is
 * rendered only in a course chat whose model can call tools, so no dead control
 * appears in a chat that could never show the card.
 */
export default function CourseMaterialAsk({
  persona,
  localState,
  setLocalState,
  sendMessage,
}) {
  const { t } = useTranslation();
  const courseId = String(persona?.courseId || "").trim();
  if (!courseId) return null;

  const tools = brandChatToolsFor({
    model: localState?.settings?.model,
    settings: localState?.settings,
    persona,
  });
  if (!tools) return null;

  const names = new Set(
    (tools.definitions || []).map((definition) => definition?.function?.name),
  );
  const showQuiz = names.has(COURSE_QUIZ_TOOL);
  const showPage = names.has(COURSE_PAGE_TOOL);
  if (!showQuiz && !showPage) return null;

  const loading = Boolean(
    localState?.messages?.some((message) => message?.loading),
  );
  const disabled = loading || !sendMessage;
  const ask = (prompt) => {
    void sendPrompt({ localState, setLocalState, sendMessage, prompt });
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <p className="text-[11px] leading-relaxed text-base-content/60">
        {t("course.material_chat.hint")}
      </p>
      {showQuiz && (
        <button
          type="button"
          data-guide="course-quiz-ask"
          className="btn btn-ghost btn-xs gap-1"
          disabled={disabled}
          onClick={() => ask(t("course.quiz_chat.prompt"))}
        >
          <CircleHelp size={12} aria-hidden="true" />
          {t("course.quiz_chat.button")}
        </button>
      )}
      {showPage && (
        <button
          type="button"
          data-guide="course-page-ask"
          className="btn btn-ghost btn-xs gap-1"
          disabled={disabled}
          onClick={() => ask(t("course.page_chat.prompt"))}
        >
          <BookOpen size={12} aria-hidden="true" />
          {t("course.page_chat.button")}
        </button>
      )}
    </div>
  );
}
