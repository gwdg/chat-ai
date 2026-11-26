// Readable feedback transcripts for the course-material blocks.
//
// A transcript that carries ```gaia-quiz {"course":…,"id":…}``` tells a reader
// nothing about what the learner actually saw or chose. The transcript sent to
// the feedback receiver is rewritten here: the question text and its options come
// from the course document, the selection from `message.meta.quizAnswers`. The
// fenced block itself stays untouched in the chat; only the copy leaves the app.
//
// The replacement is best-effort. A course that cannot be loaded, a fence that is
// not valid JSON and a question that no longer exists all keep the raw block, so
// a feedback submission is never lost to an enrichment.
import { ensureCourse } from "../../../../../utils/courseCatalog";
import {
  evaluateQuestion,
  isChoiceQuestion,
  sampleAnswer,
} from "../../../../../utils/gaiaContent";
import { skillMapOf, skillNamesOf } from "./courseMaterialText";
import {
  PAGE_FENCE_LANGUAGE,
  findCoursePage,
  pageSkillName,
  parsePageFence,
} from "./coursePagePrompt";
import { QUIZ_FENCE_LANGUAGE, parseQuizFence } from "./courseQuizPrompt";

const TYPE_LABEL = {
  single_choice: "single answer",
  multiple_choice: "multiple answers",
  open_end: "open question",
};

/** Every fenced block with its language, body and the text it replaced. */
const FENCE_PATTERN = /```([^\n]*)\n([\s\S]*?)```/g;

const optionLabel = (question, index) => {
  const option = question.answers?.[index];
  if (option === undefined) return `${index + 1}. (missing option)`;
  return `${index + 1}. ${option}`;
};

/**
 * The question, its options and how they were answered, as plain text. Pure so
 * the wording can be tested without a course document.
 */
export function formatQuizTranscript({ course, question, answer } = {}) {
  if (!question) return null;
  const title = String(course?.title || course?.id || "").trim();
  const lines = [
    `[Course quiz${title ? `: ${title}` : ""}${
      course?.id ? ` (${course.id})` : ""
    } – ${question.id}]`,
    `Question: ${question.question}`,
    `Type: ${TYPE_LABEL[question.type] || question.type}`,
  ];

  const skills = course ? skillNamesOf(question, skillMapOf(course)) : [];
  if (skills.length) lines.push(`Skills: ${skills.join(", ")}`);

  const selected = Array.isArray(answer?.selection)
    ? answer.selection
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value))
    : [];

  if (isChoiceQuestion(question)) {
    lines.push("Options:");
    (question.answers || []).forEach((option, index) => {
      const marked = question.correct?.includes(index) ? " (correct)" : "";
      const chose = selected.includes(index) ? " (selected)" : "";
      lines.push(`  ${index + 1}. ${option}${marked}${chose}`);
    });
    lines.push(
      selected.length
        ? `User selected: ${selected.map((index) => optionLabel(question, index)).join("; ")}`
        : "User selected: (nothing)",
    );
    if (answer?.checked) {
      const graded = evaluateQuestion(question, selected);
      lines.push(`Result: ${graded.correct ? "correct" : "incorrect"}`);
    } else {
      lines.push("Result: not checked");
    }
  } else {
    const written = String(answer?.text || "").trim();
    lines.push(`User answer: ${written || "(empty)"}`);
    if (answer?.checked && sampleAnswer(question)) {
      lines.push(`Sample answer: ${sampleAnswer(question)}`);
    }
  }

  if (question.explanation) lines.push(`Explanation: ${question.explanation}`);
  return lines.join("\n");
}

/** A learning page named by title and file; its HTML is not copied. */
export function formatPageTranscript({ course, page } = {}) {
  if (!page) return null;
  const title = String(course?.title || course?.id || "").trim();
  const skill = course ? pageSkillName(course, page) : "";
  const lines = [
    `[Course page${title ? `: ${title}` : ""}${
      course?.id ? ` (${course.id})` : ""
    } – ${page.title || page.file}]`,
    `File: ${page.file}`,
  ];
  if (skill) lines.push(`Skill: ${skill}`);
  lines.push("The learner saw this page rendered from the course.");
  return lines.join("\n");
}

async function quizReplacement(source, message) {
  const payload = parseQuizFence(source);
  if (!payload) return null;
  const course = await ensureCourse(payload.course);
  const question = (course?.questions || []).find(
    (item) => item.id === payload.id,
  );
  if (!question) return null;
  const answer =
    message?.meta?.quizAnswers?.[question.id] &&
    typeof message.meta.quizAnswers[question.id] === "object"
      ? message.meta.quizAnswers[question.id]
      : null;
  return formatQuizTranscript({ course, question, answer });
}

async function pageReplacement(source) {
  const payload = parsePageFence(source);
  if (!payload) return null;
  const course = await ensureCourse(payload.course);
  const page = findCoursePage(course, payload.page);
  if (!page) return null;
  return formatPageTranscript({ course, page });
}

/**
 * The feature's `feedbackText` hook: replaces each course fence with its
 * readable form. Non-course fences and any block that cannot be resolved are
 * left exactly as the message carried them.
 */
export async function courseMaterialFeedbackText(text, message) {
  const value = typeof text === "string" ? text : "";
  if (!value.includes("```")) return value;

  let output = "";
  let last = 0;
  for (const match of value.matchAll(FENCE_PATTERN)) {
    output += value.slice(last, match.index);
    last = match.index + match[0].length;
    const language = match[1].trim().split(/\s+/)[0].toLowerCase();
    let replacement = null;
    try {
      if (language === QUIZ_FENCE_LANGUAGE) {
        replacement = await quizReplacement(match[2], message);
      } else if (language === PAGE_FENCE_LANGUAGE) {
        replacement = await pageReplacement(match[2]);
      }
    } catch {
      // An unreachable course keeps the raw fence in the transcript.
      replacement = null;
    }
    output += replacement ?? match[0];
  }
  output += value.slice(last);
  return output;
}

/**
 * The state the transcript copy depends on: the answer is kept in the message
 * meta, so a newly selected option must count as a change even though the
 * message text did not move.
 */
export function courseMaterialFeedbackSignature(message) {
  const answers = message?.meta?.quizAnswers;
  return answers && typeof answers === "object" ? answers : null;
}
