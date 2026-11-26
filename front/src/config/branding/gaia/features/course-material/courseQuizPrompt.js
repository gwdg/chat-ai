// Pure helpers for the course-quiz chat block and its tool. No React and no
// network access here, so the matching rules and the model-facing text can be
// tested on their own.
import {
  matchScore,
  normalize,
  randomOf,
  skillMapOf,
  skillNamesOf,
  words,
} from "./courseMaterialText";

export const QUIZ_FENCE_LANGUAGE = "gaia-quiz";
export const COURSE_QUIZ_TOOL = "show_course_quiz";

const TYPE_LABEL = {
  single_choice: "single answer",
  multiple_choice: "multiple answers",
  open_end: "open question",
};

/**
 * Reads the fenced block. Only `course` and `id` are honoured: the question text
 * and the answers always come from the course's own JSON document, never from
 * the model's reply.
 */
export function parseQuizFence(source) {
  try {
    const data = JSON.parse(String(source ?? ""));
    const course = String(data?.course ?? "").trim();
    const id = String(data?.id ?? "").trim();
    if (!course || !id) return null;
    return { course, id };
  } catch {
    return null;
  }
}

/**
 * Picks the question the tool returns. `skill` narrows by key or name, `search`
 * scores the remaining questions by the learner's words, and a request that
 * matches nothing gets a random question instead of an error.
 */
export function pickCourseQuestion(course, { search = "", skill = "" } = {}) {
  const questions = Array.isArray(course?.questions) ? course.questions : [];
  if (questions.length === 0) return null;
  const skills = skillMapOf(course);

  let pool = questions;
  const wantedSkill = normalize(skill);
  if (wantedSkill) {
    const byKey = questions.filter((question) =>
      (question.skills || []).some((key) => normalize(key) === wantedSkill),
    );
    const byName = questions.filter((question) =>
      (question.skills || []).some((key) =>
        normalize(skills.get(key)?.name).includes(wantedSkill),
      ),
    );
    if (byKey.length) pool = byKey;
    else if (byName.length) pool = byName;
  }

  const tokens = words(search);
  if (tokens.length === 0) return randomOf(pool);

  let best = null;
  let bestScore = 0;
  for (const question of pool) {
    const haystack = normalize(
      [question.question, ...(question.tags || []), ...skillNamesOf(question, skills)].join(
        " ",
      ),
    );
    const score = matchScore(tokens, haystack);
    if (score > bestScore) {
      best = question;
      bestScore = score;
    }
  }
  return best || randomOf(pool);
}

/** The block the model must paste into its reply. */
export function quizFenceFor(course, question) {
  return [
    "```" + QUIZ_FENCE_LANGUAGE,
    JSON.stringify({ course: course.id, id: question.id }),
    "```",
  ].join("\n");
}

/**
 * The tool result. It names the question for the model but never carries the
 * answer options, the correct indexes, the sample answer or the explanation, so
 * a solution cannot reach the transcript or an agent log.
 */
export function formatQuizToolResult({ course, question }) {
  const skills = skillMapOf(course);
  const names = skillNamesOf(question, skills);
  const type = TYPE_LABEL[question.type] || question.type;

  const lines = [
    `Quiz question from the course "${course.title}": ${question.id} (${type}${names.length ? `, skill: ${names.join(", ")}` : ""}${question.status === "draft" ? ", state: draft" : ""}).`,
    `Question: ${question.question}`,
  ];

  if (question.type === "open_end") {
    lines.push(
      "This is an open question. The learner writes the answer in the card; its sample answer is revealed only after they check it, so never write it yourself.",
    );
  }

  lines.push(
    "The card renders the question and its answers itself and grades them. The answers and any explanation stay out of this result on purpose, so do not restate the question, never list or reveal an answer, and add this block exactly once at the end of your reply:",
    "",
    quizFenceFor(course, question),
  );
  return lines.join("\n");
}
