import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensureCourse } = vi.hoisted(() => ({ ensureCourse: vi.fn() }));
vi.mock("../courseCatalog", () => ({ ensureCourse }));

import { coursePageTool } from "../../config/branding/gaia/features/course-material/coursePageTool";
import {
  COURSE_PAGE_TOOL,
  PAGE_FENCE_LANGUAGE,
} from "../../config/branding/gaia/features/course-material/coursePagePrompt";

const course = {
  id: "c-programmierung",
  title: "C-Programmierung",
  skillsDoc: { skills: [{ key: "pointers", name: "Pointers" }] },
  lernseiten: [
    {
      skill: "pointers",
      file: "lernseiten/pointers.html",
      url: "/courses/c-programmierung/lernseiten/pointers.html",
      title: "Pointers step by step",
    },
  ],
};

beforeEach(() => {
  ensureCourse.mockReset();
  ensureCourse.mockResolvedValue(course);
});

describe("coursePageTool", () => {
  it("contributes nothing without a course", () => {
    expect(coursePageTool()).toBeNull();
    expect(coursePageTool({ courseId: "  " })).toBeNull();
    expect(coursePageTool({ courseId: "x" })).not.toBeNull();
  });

  it("describes the tool for the model", () => {
    const tool = coursePageTool({ courseId: "c-programmierung" });
    const definition = tool.definitions[0];
    expect(definition.function.name).toBe(COURSE_PAGE_TOOL);
    expect(definition.function.parameters.type).toBe("object");
    expect(definition.function.parameters.properties.skill).toBeTruthy();
    // The page is embedded by the block, not retyped by the model.
    expect(definition.function.description).toContain("embedded page");
  });

  it("loads the course and returns the fence, not the page", async () => {
    const tool = coursePageTool({ courseId: "c-programmierung" });
    const result = await tool.run(COURSE_PAGE_TOOL, { skill: "Pointers" });

    expect(ensureCourse).toHaveBeenCalledWith("c-programmierung");
    expect(result).toContain("Pointers step by step");
    expect(result).toContain("```" + PAGE_FENCE_LANGUAGE);
    expect(result).not.toContain("<html");
  });

  it("rejects an unknown tool name", async () => {
    const tool = coursePageTool({ courseId: "c-programmierung" });
    await expect(tool.run("other_tool", {})).rejects.toThrow(/unknown tool/i);
  });

  it("turns a course that cannot be loaded into guidance for the model", async () => {
    ensureCourse.mockRejectedValueOnce(new Error("offline"));
    const tool = coursePageTool({ courseId: "c-programmierung" });
    const result = await tool.run(COURSE_PAGE_TOOL, {});
    expect(result).toContain("could not be loaded");
  });

  it("reports a course without learning pages", async () => {
    ensureCourse.mockResolvedValueOnce({ ...course, lernseiten: [] });
    const tool = coursePageTool({ courseId: "c-programmierung" });
    const result = await tool.run(COURSE_PAGE_TOOL, {});
    expect(result).toContain("no learning pages");
  });
});
