import { describe, expect, it, vi } from "vitest";

import { combineTools } from "../../config/branding/gaia/features/course-material/combineTools";

const definition = (name) => ({
  type: "function",
  function: { name, parameters: { type: "object" } },
});

const contribution = (name, value) => ({
  definitions: [definition(name)],
  run: vi.fn(async () => value),
});

describe("combineTools", () => {
  it("merges the definitions and routes a call to its own runner", async () => {
    const quiz = contribution("show_course_quiz", "quiz");
    const page = contribution("show_course_page", "page");

    const tools = combineTools(quiz, page);
    expect(tools.definitions.map((item) => item.function.name)).toEqual([
      "show_course_quiz",
      "show_course_page",
    ]);

    await expect(tools.run("show_course_quiz", { search: "x" })).resolves.toBe(
      "quiz",
    );
    await expect(tools.run("show_course_page", {})).resolves.toBe("page");
    expect(quiz.run).toHaveBeenCalledWith("show_course_quiz", { search: "x" });
    expect(page.run).toHaveBeenCalledWith("show_course_page", {});
  });

  it("skips missing contributions and duplicate names", () => {
    const first = contribution("show_course_quiz", "first");
    const second = contribution("show_course_quiz", "second");
    const tools = combineTools(null, first, undefined, second);
    expect(tools.definitions).toHaveLength(1);
  });

  it("returns null when nothing contributes a definition", () => {
    expect(combineTools()).toBeNull();
    expect(combineTools(null, undefined)).toBeNull();
    expect(combineTools({ definitions: [], run: vi.fn() })).toBeNull();
  });

  it("rejects an unknown tool name", async () => {
    const tools = combineTools(contribution("show_course_quiz", "quiz"));
    await expect(tools.run("other_tool", {})).rejects.toThrow(/unknown tool/i);
  });
});
