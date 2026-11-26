// The GAIA course-material feature: course questions and learning pages inside
// a course chat.
//
// The tutor decides when to show something. It calls `show_course_quiz` or
// `show_course_page`, and the reply carries only a `gaia-quiz` / `gaia-page`
// fenced block with the course and the item's id; the card reads the question
// or the page from the course's own documents. Every file a chat needs lives in
// this folder — generic code only knows the registry in `config/brandFeatures.js`.
import CoursePageBlock from "./CoursePageBlock.jsx";
import CourseMaterialAsk from "./CourseMaterialAsk.jsx";
import CourseQuizBlock from "./CourseQuizBlock.jsx";
import { combineTools } from "./combineTools";
import { coursePageTool } from "./coursePageTool";
import {
  courseMaterialFeedbackSignature,
  courseMaterialFeedbackText,
} from "./courseMaterialFeedback";
import { courseQuizTool } from "./courseQuizTool";

export default {
  key: "course_material",
  fences: {
    "gaia-quiz": CourseQuizBlock,
    "gaia-page": CoursePageBlock,
  },
  personaBanner: CourseMaterialAsk,
  feedbackText: courseMaterialFeedbackText,
  feedbackSignature: courseMaterialFeedbackSignature,
  chatTool: ({ persona } = {}) =>
    combineTools(
      courseQuizTool({ courseId: persona?.courseId }),
      coursePageTool({ courseId: persona?.courseId }),
    ),
};
