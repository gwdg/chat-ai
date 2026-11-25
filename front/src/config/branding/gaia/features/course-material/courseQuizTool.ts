import { ensureCourse } from "../../../../../utils/courseCatalog";
import {
  COURSE_QUIZ_TOOL,
  formatQuizToolResult,
  pickCourseQuestion,
} from "./courseQuizPrompt";

const DESCRIPTION = [
  "Show one of this course's existing quiz questions to the learner as an interactive card.",
  "Call it when the learner asks for a quiz or practice question, or when a question would help them check a skill.",
  "Pass search with the learner's own words, or skill with a skill key or name, to choose a suitable question.",
  "The tool returns the question and the block to include. The card renders the question and its answers itself:",
  "never repeat them as text, never reveal the answer, and put the returned block exactly once in your reply.",
].join(" ");

const PARAMETERS = {
  type: "object",
  properties: {
    search: {
      type: "string",
      description:
        "Words from the learner's request (a topic, term or phrase). Omit for any question.",
    },
    skill: {
      type: "string",
      description: "A skill key or skill name of this course, when the learner names one.",
    },
  },
  additionalProperties: false,
};

/**
 * The `show_course_quiz` function tool for one course chat. Returns null when
 * the conversation has no course, so a normal persona chat contributes nothing.
 */
export function courseQuizTool({ courseId } = {}) {
  const id = String(courseId || "").trim();
  if (!id) return null;

  return {
    definitions: [
      {
        type: "function",
        function: {
          name: COURSE_QUIZ_TOOL,
          description: DESCRIPTION,
          parameters: PARAMETERS,
        },
      },
    ],
    run: async (name, args = {}) => {
      if (name !== COURSE_QUIZ_TOOL) throw new Error(`Unknown tool: ${name}`);
      let course;
      try {
        course = await ensureCourse(id);
      } catch {
        return "The course's quiz questions could not be loaded right now. Tell the learner that the quiz is unavailable and offer the course page instead.";
      }
      const question = pickCourseQuestion(course, args || {});
      if (!question) {
        return "This course has no quiz questions. Tell the learner so and offer the course page instead.";
      }
      return formatQuizToolResult({ course, question });
    },
  };
}
