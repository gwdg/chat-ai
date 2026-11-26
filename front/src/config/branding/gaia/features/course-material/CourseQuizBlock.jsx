import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import CourseQuizQuestion from "../../../../../components/Course/CourseQuizQuestion";
import { useAssistantMessage } from "../../../../../components/Conversation/MessageAssistant/AssistantMessageContext";
import {
  emptyAnswer,
  toggleQuizOption,
  updateQuizAnswer,
} from "../../../../../components/Course/quizAnswer";
import { ensureCourse } from "../../../../../utils/courseCatalog";
import { evaluateQuestion } from "../../../../../utils/gaiaContent";
import { parseQuizFence } from "./courseQuizPrompt";

/** The answer this card kept on its message, if any. */
const storedAnswerOf = (assistant, questionId) => {
  if (!assistant?.getMessage || !questionId) return null;
  const stored = assistant.getMessage()?.meta?.quizAnswers?.[questionId];
  return stored && typeof stored === "object"
    ? { ...emptyAnswer(), ...stored }
    : null;
};

/**
 * The interactive quiz card inside a course chat.
 *
 * The fenced block carries only the course id and the question id; the question
 * itself always comes from the course's own JSON document, so the model can
 * neither rewrite it nor attach an answer.
 *
 * The answer the user gives is kept on the assistant message
 * (`message.meta.quizAnswers[questionId]`), so reloading or reopening the chat
 * shows the same selection, grading and explanation. The practice quiz on the
 * course page is unrelated and still starts fresh.
 */
export default function CourseQuizBlock({ source }) {
  const { t } = useTranslation();
  const assistant = useAssistantMessage();
  const payload = useMemo(() => parseQuizFence(source), [source]);
  const questionId = String(payload?.id || "");
  const [state, setState] = useState({ status: "loading" });
  const [answer, setAnswer] = useState(
    () => storedAnswerOf(assistant, questionId) ?? emptyAnswer(),
  );

  useEffect(() => {
    let cancelled = false;
    // A changed fence starts again from whatever this message already kept.
    setAnswer(storedAnswerOf(assistant, questionId) ?? emptyAnswer());
    if (!payload) {
      setState({ status: "invalid" });
      return () => {};
    }
    setState({ status: "loading" });
    ensureCourse(payload.course)
      .then((course) => {
        if (cancelled) return;
        const question = (course.questions || []).find(
          (item) => item.id === payload.id,
        );
        setState(question ? { status: "ready", course, question } : { status: "missing", course });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, [payload?.course, payload?.id]);

  if (state.status === "invalid" || state.status === "error") {
    return (
      <p className="my-2 text-xs text-base-content/60" data-guide="course-quiz-block">
        {t("course.quiz_chat.block_error")}
      </p>
    );
  }

  if (state.status === "missing") {
    return (
      <p className="my-2 text-xs text-base-content/60" data-guide="course-quiz-block">
        {t("course.quiz_chat.block_missing")}{" "}
        <Link
          to={`/course/${state.course.id}`}
          className="text-info hover:underline"
        >
          {t("course.open_course")}
        </Link>
      </p>
    );
  }

  if (state.status === "loading") {
    return (
      <p className="my-2 flex items-center gap-2 text-xs text-base-content/60">
        <span className="loading loading-spinner loading-xs" />
        {t("course.quiz_chat.block_loading")}
      </p>
    );
  }

  const { question } = state;

  // Empty answers are dropped from the message again, so a reset question does
  // not keep a metadata entry that says nothing.
  const remember = (next) => {
    if (!assistant?.setMessageMeta || !questionId) return;
    assistant.setMessageMeta((meta) => {
      const answers = { ...(meta?.quizAnswers || {}) };
      const untouched =
        !next.checked && !(next.selection?.length) && !String(next.text || "").trim();
      if (untouched) delete answers[questionId];
      else answers[questionId] = next;
      return { quizAnswers: answers };
    });
  };

  const changeAnswer = (patch) => {
    const next = updateQuizAnswer(answer, patch);
    setAnswer(next);
    remember(next);
  };

  const toggleOption = (optionIndex) => {
    const next = toggleQuizOption(question, answer, optionIndex);
    setAnswer(next);
    remember(next);
  };

  return (
    <div className="my-3 flex flex-col gap-2" data-guide="course-quiz-block">
      <CourseQuizQuestion
        question={question}
        answer={answer}
        graded={evaluateQuestion(question, answer.selection)}
        onToggleOption={toggleOption}
        onChange={changeAnswer}
      />
    </div>
  );
}
