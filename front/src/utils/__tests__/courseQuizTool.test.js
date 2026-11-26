import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensureCourse } = vi.hoisted(() => ({ ensureCourse: vi.fn() }));
vi.mock("../courseCatalog", () => ({ ensureCourse }));

import { courseQuizTool } from "../../config/branding/gaia/features/course-material/courseQuizTool";
import {
  COURSE_QUIZ_TOOL,
  QUIZ_FENCE_LANGUAGE,
} from "../../config/branding/gaia/features/course-material/courseQuizPrompt";

const course = {
  id: "c-programmierung",
  title: "C-Programmierung",
  skillsDoc: { skills: [{ key: "pointers", name: "Pointers" }] },
  questions: [
    {
      id: "question-7",
      type: "single_choice",
      question: "What does a pointer store?",
      answers: ["An address", "A value"],
      correct: [0],
      skills: ["pointers"],
      tags: [],
      status: "final",
      explanation: "It stores an address.",
    },
  ],
};

beforeEach(() => {
  ensureCourse.mockReset();
  ensureCourse.mockResolvedValue(course);
});

describe("courseQuizTool", () => {
  it("contributes nothing without a course", () => {
    expect(courseQuizTool()).toBeNull();
    expect(courseQuizTool({ courseId: "  " })).toBeNull();
    expect(courseQuizTool({ courseId: "x" })).not.toBeNull();
  });

  it("describes the tool for the model", () => {
    const tool = courseQuizTool({ courseId: "c-programmierung" });
    const definition = tool.definitions[0];
    expect(definition.function.name).toBe(COURSE_QUIZ_TOOL);
    expect(definition.function.parameters.type).toBe("object");
    expect(definition.function.parameters.properties.search).toBeTruthy();
    // Never repeat the answers or reveal the solution in the reply.
    expect(definition.function.description).toContain("never reveal the answer");
  });

  it("loads the course and returns the fence but no solution", async () => {
    const tool = courseQuizTool({ courseId: "c-programmierung" });
    const result = await tool.run(COURSE_QUIZ_TOOL, { skill: "Pointers" });

    expect(ensureCourse).toHaveBeenCalledWith("c-programmierung");
    expect(result).toContain("question-7");
    expect(result).toContain("```" + QUIZ_FENCE_LANGUAGE);
    expect(result).not.toContain("An address");
    expect(result).not.toContain("It stores an address.");
  });

  it("rejects an unknown tool name", async () => {
    const tool = courseQuizTool({ courseId: "c-programmierung" });
    await expect(tool.run("other_tool", {})).rejects.toThrow(/unknown tool/i);
  });

  it("turns a course that cannot be loaded into guidance for the model", async () => {
    ensureCourse.mockRejectedValueOnce(new Error("offline"));
    const tool = courseQuizTool({ courseId: "c-programmierung" });
    const result = await tool.run(COURSE_QUIZ_TOOL, {});
    expect(result).toContain("could not be loaded");
  });

  it("reports a course without questions", async () => {
    ensureCourse.mockResolvedValueOnce({ ...course, questions: [] });
    const tool = courseQuizTool({ courseId: "c-programmierung" });
    const result = await tool.run(COURSE_QUIZ_TOOL, {});
    expect(result).toContain("no quiz questions");
  });
});
