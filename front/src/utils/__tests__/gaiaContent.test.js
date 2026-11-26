import { describe, expect, it } from "vitest";

import {
  buildCourseStats,
  correctAnswerIndexes,
  evaluateQuestion,
  parseQuizDocument,
  parseSkillsDocument,
  questionsForSkill,
  sampleAnswer,
} from "../gaiaContent";

const SKILLS = JSON.stringify({
  format: "gaia-skills",
  version: 1,
  topics: [
    { key: "intro", unit: "Intro", name: "Introduction", description: "Basics." },
    { key: "functions", unit: "Functions", name: "Functions", description: "" },
    { key: "empty", unit: "Empty", name: "Empty topic", description: "" },
  ],
  skills: [
    {
      key: "hello_world",
      topic_key: "intro",
      concept: "hello world",
      name: "Write hello world",
      description: "A first program.",
      prerequisites: [],
    },
    {
      key: "call_by_value",
      topic_key: "functions",
      concept: "call by value",
      name: "Explain call by value",
      description: "Parameters are copies.",
      prerequisites: ["hello_world", "missing_skill"],
    },
  ],
});

const QUIZ = JSON.stringify({
  format: "gaia-quiz",
  version: 1,
  questions: [
    {
      type: "single_choice",
      question: "Which index does the first answer have?",
      answers: ["One", "Two"],
      correct: [2],
      skills: ["hello_world"],
      status: "draft",
    },
    {
      type: "multiple_choice",
      question: "Pick both",
      answers: ["A", "B", "C"],
      correct: [1, 3],
      skills: ["call_by_value"],
      status: "released",
    },
    {
      type: "open_end",
      question: "Explain call by value.",
      answers: ["The parameter receives a copy of the argument."],
      correct: [],
      skills: ["call_by_value"],
      status: "draft",
    },
    { type: "unknown", question: "Dropped", answers: [] },
  ],
});

describe("gaiaContent skills", () => {
  it("groups skills by topic and drops empty topics", () => {
    const doc = parseSkillsDocument(SKILLS);

    expect(doc.topics).toHaveLength(3);
    expect(doc.skills).toHaveLength(2);
    expect(doc.groups.map((group) => group.topic.key)).toEqual([
      "intro",
      "functions",
    ]);
    expect(doc.groups[1].skills.map((skill) => skill.key)).toEqual([
      "call_by_value",
    ]);
  });

  it("resolves prerequisites and marks unknown keys", () => {
    const doc = parseSkillsDocument(SKILLS);
    const skill = doc.skillByKey.get("call_by_value");

    expect(skill.prerequisiteSkills).toEqual([
      { key: "hello_world", name: "Write hello world", known: true },
      { key: "missing_skill", name: "missing_skill", known: false },
    ]);
  });
});

describe("gaiaContent quiz", () => {
  it("converts 1-based answer indexes and skips invalid questions", () => {
    const doc = parseQuizDocument(QUIZ);

    expect(doc.questions).toHaveLength(3);
    expect(doc.questions[0].correct).toEqual([1]);
    expect(doc.questions[1].correct).toEqual([0, 2]);
    expect(correctAnswerIndexes({ answers: ["a"], correct: [1, 3, 9] })).toEqual(
      [0],
    );
  });

  it("grades selections and reports missing/wrong answers", () => {
    const doc = parseQuizDocument(QUIZ);
    const multiple = doc.questions[1];

    expect(evaluateQuestion(multiple, [0, 2]).correct).toBe(true);
    expect(evaluateQuestion(multiple, [0])).toMatchObject({
      graded: true,
      correct: false,
      missing: [2],
      wrong: [],
    });
    expect(evaluateQuestion(multiple, [0, 1])).toMatchObject({
      correct: false,
      missing: [2],
      wrong: [1],
    });
    expect(evaluateQuestion(doc.questions[2], [])).toEqual({
      graded: false,
      correct: null,
      missing: [],
      wrong: [],
    });
  });

  it("reveals the sample answer of an open question only", () => {
    const doc = parseQuizDocument(QUIZ);

    expect(sampleAnswer(doc.questions[2])).toContain("copy of the argument");
    expect(sampleAnswer(doc.questions[0])).toBe("");
  });

  it("filters by skill and counts both choice types", () => {
    const doc = parseQuizDocument(QUIZ);

    expect(questionsForSkill(doc.questions, "call_by_value")).toHaveLength(2);
    expect(questionsForSkill(doc.questions, "")).toHaveLength(3);
  });

  it("summarizes coverage for the review view", () => {
    const stats = buildCourseStats({
      skillsDoc: parseSkillsDocument(SKILLS),
      quizDoc: parseQuizDocument(QUIZ),
      lernseiten: [
        { skill: "call_by_value", url: "x.html", title: "X", file: "x.html" },
      ],
    });

    expect(stats).toMatchObject({
      topics: 3,
      skills: 2,
      questions: 3,
      byType: { single_choice: 1, multiple_choice: 1, open_end: 1 },
      lernseiten: 1,
      skillsWithLernseite: 1,
      drafts: 2,
      withExplanation: 0,
    });
  });
});
