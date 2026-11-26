import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../utils/courseCatalog", () => ({
  ensureCourse: vi.fn(),
}));

import { ensureCourse } from "../../../../../../utils/courseCatalog";
import {
  courseMaterialFeedbackSignature,
  courseMaterialFeedbackText,
  formatPageTranscript,
  formatQuizTranscript,
} from "../courseMaterialFeedback";

const course = {
  id: "c-programmierung",
  title: "C-Programmierung",
  questions: [
    {
      id: "question-98",
      type: "multiple_choice",
      question: "Welche Aussagen sind richtig?",
      answers: ["A", "B", "C"],
      correct: [0, 2],
      skills: ["arrays"],
      explanation: "Weil B falsch ist.",
    },
    {
      id: "open-1",
      type: "open_end",
      question: "Erkläre Zeiger.",
      answers: ["Ein Zeiger merkt sich eine Adresse."],
      correct: [],
      skills: [],
      explanation: "",
    },
  ],
  lernseiten: [
    {
      skill: "arrays",
      file: "lernseiten/arrays.html",
      url: "http://courses.test/lernseiten/arrays.html",
      title: "Arrays",
    },
  ],
  skillsDoc: { skills: [{ key: "arrays", name: "Arrays" }] },
};

const quizFence = (id = "question-98") =>
  [
    "Here you go:",
    "```gaia-quiz",
    JSON.stringify({ course: "c-programmierung", id }),
    "```",
    "Done.",
  ].join("\n");

beforeEach(() => {
  ensureCourse.mockReset();
  ensureCourse.mockResolvedValue(course);
});

describe("formatQuizTranscript", () => {
  it("names the question, its options and how they were answered", () => {
    const text = formatQuizTranscript({
      course,
      question: course.questions[0],
      answer: { selection: [1], checked: true },
    });

    expect(text).toContain("Course quiz: C-Programmierung (c-programmierung)");
    expect(text).toContain("Question: Welche Aussagen sind richtig?");
    expect(text).toContain("1. A (correct)");
    expect(text).toContain("2. B (selected)");
    expect(text).toContain("3. C (correct)");
    expect(text).toContain("User selected: 2. B");
    expect(text).toContain("Result: incorrect");
    expect(text).toContain("Explanation: Weil B falsch ist.");
    expect(text).toContain("Skills: Arrays");
  });

  it("marks a correct selection and an answer that was never checked", () => {
    const correct = formatQuizTranscript({
      course,
      question: course.questions[0],
      answer: { selection: [0, 2], checked: true },
    });
    expect(correct).toContain("User selected: 1. A; 3. C");
    expect(correct).toContain("Result: correct");

    const unchecked = formatQuizTranscript({
      course,
      question: course.questions[0],
      answer: { selection: [1], checked: false },
    });
    expect(unchecked).toContain("Result: not checked");
  });

  it("says so when nothing was selected", () => {
    const text = formatQuizTranscript({
      course,
      question: course.questions[0],
      answer: null,
    });
    expect(text).toContain("User selected: (nothing)");
    expect(text).toContain("Result: not checked");
  });

  it("keeps the written answer of an open question and its sample answer", () => {
    const text = formatQuizTranscript({
      course,
      question: course.questions[1],
      answer: { text: "Adresse im Speicher", checked: true },
    });
    expect(text).toContain("User answer: Adresse im Speicher");
    expect(text).toContain("Sample answer: Ein Zeiger merkt sich eine Adresse.");
  });
});

describe("formatPageTranscript", () => {
  it("names the page without copying its HTML", () => {
    const text = formatPageTranscript({ course, page: course.lernseiten[0] });
    expect(text).toContain("Course page: C-Programmierung (c-programmierung) – Arrays");
    expect(text).toContain("File: lernseiten/arrays.html");
    expect(text).toContain("Skill: Arrays");
  });
});

describe("courseMaterialFeedbackText", () => {
  it("replaces a quiz fence with the readable transcript", async () => {
    const out = await courseMaterialFeedbackText(quizFence(), {
      meta: { quizAnswers: { "question-98": { selection: [0, 2], checked: true } } },
    });

    expect(ensureCourse).toHaveBeenCalledWith("c-programmierung");
    expect(out.startsWith("Here you go:")).toBe(true);
    expect(out.endsWith("Done.")).toBe(true);
    expect(out).not.toContain("```");
    expect(out).not.toContain('"course"');
    expect(out).toContain("Question: Welche Aussagen sind richtig?");
    expect(out).toContain("User selected: 1. A; 3. C");
    expect(out).toContain("Result: correct");
  });

  it("replaces a page fence with the page's title", async () => {
    const text = ["Look:", "```gaia-page", '{"course":"c-programmierung","page":"arrays.html"}', "```"].join(
      "\n",
    );
    const out = await courseMaterialFeedbackText(text, {});
    expect(out).toContain("Course page: C-Programmierung (c-programmierung) – Arrays");
    expect(out).toContain("File: lernseiten/arrays.html");
  });

  it("leaves the raw fence when the course cannot be loaded", async () => {
    ensureCourse.mockRejectedValueOnce(new Error("offline"));
    const fence = quizFence();
    const out = await courseMaterialFeedbackText(fence, {});
    expect(out).toBe(fence);
  });

  it("leaves the raw fence when the question no longer exists", async () => {
    const fence = quizFence("question-missing");
    const out = await courseMaterialFeedbackText(fence, {});
    expect(out).toBe(fence);
  });

  it("leaves other fenced blocks alone", async () => {
    const text = "```js\nconsole.log(1);\n```";
    await expect(courseMaterialFeedbackText(text, {})).resolves.toBe(text);
    expect(ensureCourse).not.toHaveBeenCalled();
  });

  it("does nothing for text without a fence", async () => {
    await expect(courseMaterialFeedbackText("plain", {})).resolves.toBe("plain");
    expect(ensureCourse).not.toHaveBeenCalled();
  });
});

describe("courseMaterialFeedbackSignature", () => {
  it("reports the answers kept on the message", () => {
    const answers = { "question-98": { selection: [1], checked: true } };
    expect(courseMaterialFeedbackSignature({ meta: { quizAnswers: answers } })).toEqual(
      answers,
    );
    expect(courseMaterialFeedbackSignature({ meta: {} })).toBeNull();
    expect(courseMaterialFeedbackSignature(null)).toBeNull();
  });
});
