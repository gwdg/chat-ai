import { describe, expect, it } from "vitest";

import {
  QUIZ_FENCE_LANGUAGE,
  formatQuizToolResult,
  parseQuizFence,
  pickCourseQuestion,
  quizFenceFor,
} from "../../config/branding/gaia/features/course-material/courseQuizPrompt";

const course = {
  id: "c-programmierung",
  title: "C-Programmierung",
  skillsDoc: {
    skills: [
      { key: "call_by_value", name: "Call by value" },
      { key: "pointers", name: "Pointers" },
    ],
  },
  questions: [
    {
      id: "question-1",
      type: "single_choice",
      question: "Which answer is correct?",
      answers: ["Wrong", "Right"],
      correct: [1],
      skills: ["call_by_value"],
      tags: ["functions"],
      status: "draft",
      explanation: "The parameter receives a copy.",
    },
    {
      id: "question-2",
      type: "open_end",
      question: "Explain pointers.",
      answers: ["A pointer stores an address."],
      correct: [],
      skills: ["pointers"],
      tags: ["memory"],
      status: "final",
      explanation: "",
    },
  ],
};

describe("parseQuizFence", () => {
  it("accepts only a course and a question id", () => {
    expect(parseQuizFence('{"course":"c-programmierung","id":"question-1"}')).toEqual({
      course: "c-programmierung",
      id: "question-1",
    });
    // Extra fields are ignored, so model-supplied text can never reach the card.
    expect(
      parseQuizFence('{"course":"c","id":"q","question":"made up","answers":["x"]}'),
    ).toEqual({ course: "c", id: "q" });
  });

  it("rejects malformed JSON and incomplete payloads", () => {
    expect(parseQuizFence("not json")).toBeNull();
    expect(parseQuizFence('{"course":"c"}')).toBeNull();
    expect(parseQuizFence('{"id":"q"}')).toBeNull();
    expect(parseQuizFence("")).toBeNull();
  });
});

describe("pickCourseQuestion", () => {
  it("picks a question for a skill key and for a skill name", () => {
    expect(pickCourseQuestion(course, { skill: "call_by_value" })?.id).toBe(
      "question-1",
    );
    expect(pickCourseQuestion(course, { skill: "Pointers" })?.id).toBe(
      "question-2",
    );
  });

  it("scores the learner's words against the question and its skill", () => {
    expect(pickCourseQuestion(course, { search: "functions" })?.id).toBe(
      "question-1",
    );
    expect(pickCourseQuestion(course, { search: "memory address" })?.id).toBe(
      "question-2",
    );
  });

  it("falls back to a question from the pool instead of failing", () => {
    const picked = pickCourseQuestion(course, { search: "nothing matches here" });
    expect(["question-1", "question-2"]).toContain(picked?.id);
  });

  it("returns null for a course without questions", () => {
    expect(pickCourseQuestion({ questions: [] })).toBeNull();
    expect(pickCourseQuestion(null)).toBeNull();
  });
});

describe("quizFenceFor", () => {
  it("emits a fenced block with the language and the two ids only", () => {
    const fence = quizFenceFor(course, course.questions[0]);
    expect(fence).toBe(
      [
        "```" + QUIZ_FENCE_LANGUAGE,
        '{"course":"c-programmierung","id":"question-1"}',
        "```",
      ].join("\n"),
    );
  });
});

describe("formatQuizToolResult", () => {
  it("names the question and returns the block, but no answer or explanation", () => {
    const result = formatQuizToolResult({
      course,
      question: course.questions[0],
    });

    expect(result).toContain("question-1");
    expect(result).toContain("Which answer is correct?");
    expect(result).toContain("```" + QUIZ_FENCE_LANGUAGE);
    expect(result).toContain('"id":"question-1"');
    // The answers, the correct index and the explanation must never reach the model.
    expect(result).not.toContain("Wrong");
    expect(result).not.toContain("Right");
    expect(result).not.toContain("The parameter receives a copy.");
  });

  it("tells the model not to reveal an open question's sample answer", () => {
    const result = formatQuizToolResult({
      course,
      question: course.questions[1],
    });
    expect(result).toContain("open question");
    expect(result).not.toContain("A pointer stores an address.");
  });
});
