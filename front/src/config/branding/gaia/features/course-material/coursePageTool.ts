import { ensureCourse } from "../../../../../utils/courseCatalog";
import {
  COURSE_PAGE_TOOL,
  formatPageToolResult,
  pickCoursePage,
} from "./coursePagePrompt";

const DESCRIPTION = [
  "Show one of this course's learning pages (Lernseite) inside the chat, as an embedded page in your reply.",
  "Call it when the learner asks for an explanation of a skill, a step-by-step walkthrough, or the course's own learning material on a topic.",
  "Pass search with the learner's own words, or skill with a skill key or name, to choose a suitable page.",
  "The tool returns the page and the block to include. The card loads the page itself: introduce it in one short sentence and put the returned block exactly once at the end of your reply.",
].join(" ");

const PARAMETERS = {
  type: "object",
  properties: {
    search: {
      type: "string",
      description:
        "Words from the learner's request (a topic, term or phrase). Omit for any page.",
    },
    skill: {
      type: "string",
      description: "A skill key or skill name of this course, when the learner names one.",
    },
  },
  additionalProperties: false,
};

/**
 * The `show_course_page` function tool for one course chat. Returns null when
 * the conversation has no course, so a normal persona chat contributes nothing.
 */
export function coursePageTool({ courseId } = {}) {
  const id = String(courseId || "").trim();
  if (!id) return null;

  return {
    definitions: [
      {
        type: "function",
        function: {
          name: COURSE_PAGE_TOOL,
          description: DESCRIPTION,
          parameters: PARAMETERS,
        },
      },
    ],
    run: async (name, args = {}) => {
      if (name !== COURSE_PAGE_TOOL) throw new Error(`Unknown tool: ${name}`);
      let course;
      try {
        course = await ensureCourse(id);
      } catch {
        return "The course's learning pages could not be loaded right now. Tell the learner that the page is unavailable and offer the course page instead.";
      }
      const page = pickCoursePage(course, args || {});
      if (!page) {
        return "This course has no learning pages. Tell the learner so and offer the course page instead.";
      }
      return formatPageToolResult({ course, page });
    },
  };
}
