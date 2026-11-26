import { useTranslation } from "react-i18next";
import { Check, RotateCcw } from "lucide-react";

import { isChoiceQuestion, sampleAnswer } from "../../utils/gaiaContent";
import { QUIZ_TYPE_LABEL_KEY } from "./quizAnswer";

/**
 * One question card, used by the course page's practice quiz and by the quiz
 * block in a course chat. The answer state stays with the caller, so the page
 * keeps the answers while navigating and the chat card owns a single answer.
 *
 * `progress` and `footer` are optional: the page shows "question 3 of 12" and
 * its previous/next controls, the chat card shows neither.
 */
export default function CourseQuizQuestion({
  question,
  answer,
  graded,
  onToggleOption,
  onChange,
  progress = null,
  footer = null,
}) {
  const { t } = useTranslation();
  if (!question) return null;

  const checked = Boolean(answer?.checked);
  const selection = Array.isArray(answer?.selection) ? answer.selection : [];

  return (
    <section className="rounded-xl border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="badge badge-ghost badge-sm">
          {t(QUIZ_TYPE_LABEL_KEY[question.type] || "course.quiz.type_single")}
        </span>
        {question.status === "draft" && (
          <span className="badge badge-warning badge-sm badge-outline">
            {t("course.quiz.draft")}
          </span>
        )}
        {progress && (
          <span className="ml-auto text-xs text-base-content/60">{progress}</span>
        )}
      </div>

      <h3 className="mt-3 text-sm font-semibold leading-relaxed text-base-content">
        {question.question}
      </h3>

      <div className="mt-3 flex flex-col gap-2">
        {isChoiceQuestion(question) &&
          question.answers.map((option, optionIndex) => {
            const selected = selection.includes(optionIndex);
            const isCorrect = question.correct.includes(optionIndex);
            let tone = "border-base-300";
            if (checked && isCorrect) {
              tone = "border-success bg-success/10";
            } else if (checked && selected && !isCorrect) {
              tone = "border-error bg-error/10";
            }
            return (
              <label
                key={`${question.id}-${optionIndex}`}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm leading-relaxed ${tone}`}
              >
                <input
                  type={question.type === "single_choice" ? "radio" : "checkbox"}
                  className={
                    question.type === "single_choice"
                      ? "radio radio-sm mt-0.5"
                      : "checkbox checkbox-sm mt-0.5"
                  }
                  name={`course-question-${question.id}`}
                  checked={selected}
                  disabled={checked}
                  onChange={() => onToggleOption?.(optionIndex)}
                />
                <span>{option}</span>
              </label>
            );
          })}

        {question.type === "open_end" && (
          <textarea
            className="textarea textarea-bordered min-h-24 w-full text-sm"
            value={answer?.text || ""}
            onChange={(event) => onChange?.({ text: event.target.value })}
            aria-label={t("course.quiz.question_label")}
            placeholder={t("course.quiz.sample_answer")}
          />
        )}
      </div>

      {checked && (
        <div className="mt-3 flex flex-col gap-2">
          {question.type === "open_end" ? (
            <p className="rounded-lg bg-base-200 px-3 py-2 text-xs leading-relaxed text-base-content/80">
              {t("course.quiz.open_note")}
            </p>
          ) : (
            <p
              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                graded?.correct
                  ? "bg-success/10 text-success"
                  : "bg-error/10 text-error"
              }`}
            >
              {graded?.correct
                ? t("course.quiz.correct")
                : t("course.quiz.incorrect")}
            </p>
          )}
          {question.type === "open_end" && sampleAnswer(question) && (
            <div className="rounded-lg border border-base-300 px-3 py-2">
              <p className="text-xs font-semibold text-base-content">
                {t("course.quiz.sample_answer")}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-base-content/80">
                {sampleAnswer(question)}
              </p>
            </div>
          )}
          {question.explanation && (
            <div className="rounded-lg border border-base-300 px-3 py-2">
              <p className="text-xs font-semibold text-base-content">
                {t("course.quiz.explanation")}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-base-content/80">
                {question.explanation}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!checked ? (
          <>
            <button
              type="button"
              className="btn btn-accent btn-sm gap-1"
              disabled={isChoiceQuestion(question) && selection.length === 0}
              onClick={() => onChange?.({ checked: true })}
            >
              <Check size={14} aria-hidden="true" />
              {t("course.quiz.check")}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onChange?.({ checked: true })}
            >
              {t("course.quiz.show_solution")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1"
            onClick={() => onChange?.({ checked: false, selection: [], text: "" })}
          >
            <RotateCcw size={14} aria-hidden="true" />
            {t("course.quiz.reset")}
          </button>
        )}

        {footer}
      </div>
    </section>
  );
}
