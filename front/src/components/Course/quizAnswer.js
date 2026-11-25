// Answer state and labels shared by the course quiz page and the chat's quiz
// card, so both grade and label a question the same way.

export const QUIZ_TYPE_LABEL_KEY = {
  single_choice: "course.quiz.type_single",
  multiple_choice: "course.quiz.type_multiple",
  open_end: "course.quiz.type_open",
};

export const emptyAnswer = () => ({ selection: [], checked: false, text: "" });

/**
 * Selects or deselects one answer. A single-choice question replaces the
 * selection, a multiple-choice question toggles the option; a checked answer is
 * frozen until it is reset.
 */
export function toggleQuizOption(question, answer, optionIndex) {
  const current = answer || emptyAnswer();
  if (!question || current.checked) return current;
  if (question.type === "single_choice") {
    return { ...current, selection: [optionIndex] };
  }
  const selection = Array.isArray(current.selection) ? current.selection : [];
  const next = selection.includes(optionIndex)
    ? selection.filter((value) => value !== optionIndex)
    : [...selection, optionIndex].sort((a, b) => a - b);
  return { ...current, selection: next };
}

/** Merges a patch into the answer of one question. */
export function updateQuizAnswer(answer, patch) {
  return { ...(answer || emptyAnswer()), ...(patch || {}) };
}
