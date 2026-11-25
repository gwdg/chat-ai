import { describe, expect, it } from "vitest";

import {
  PAGE_FENCE_LANGUAGE,
  findCoursePage,
  formatPageToolResult,
  pageFenceFor,
  pageSkillName,
  parsePageFence,
  pickCoursePage,
} from "../../config/branding/gaia/features/course-material/coursePagePrompt";

const course = {
  id: "c-programmierung",
  title: "C-Programmierung",
  skillsDoc: {
    skills: [
      { key: "call_by_value", name: "Call by value" },
      { key: "pointers", name: "Pointers" },
    ],
  },
  lernseiten: [
    {
      skill: "pointers",
      file: "lernseiten/pointers.html",
      url: "/courses/c-programmierung/lernseiten/pointers.html",
      title: "Pointers step by step",
    },
    {
      skill: "call_by_value",
      file: "lernseiten/call-by-value.html",
      url: "/courses/c-programmierung/lernseiten/call-by-value.html",
      title: "Passing arguments",
    },
  ],
};

describe("parsePageFence", () => {
  it("accepts only a course and a page", () => {
    expect(
      parsePageFence('{"course":"c-programmierung","page":"lernseiten/pointers.html"}'),
    ).toEqual({ course: "c-programmierung", page: "lernseiten/pointers.html" });
    // Extra fields are ignored, so model-supplied HTML can never reach the block.
    expect(
      parsePageFence('{"course":"c","page":"p","html":"<p>made up</p>"}'),
    ).toEqual({ course: "c", page: "p" });
  });

  it("rejects malformed JSON and incomplete payloads", () => {
    expect(parsePageFence("not json")).toBeNull();
    expect(parsePageFence('{"course":"c"}')).toBeNull();
    expect(parsePageFence('{"page":"p"}')).toBeNull();
    expect(parsePageFence("")).toBeNull();
  });
});

describe("findCoursePage", () => {
  it("finds a page by file, skill and a bare file name", () => {
    expect(findCoursePage(course, "lernseiten/pointers.html")?.title).toBe(
      "Pointers step by step",
    );
    expect(findCoursePage(course, "pointers")?.title).toBe(
      "Pointers step by step",
    );
    expect(findCoursePage(course, "pointers.html")?.title).toBe(
      "Pointers step by step",
    );
  });

  it("returns null for an unknown page", () => {
    expect(findCoursePage(course, "lernseiten/missing.html")).toBeNull();
    expect(findCoursePage(course, "")).toBeNull();
    expect(findCoursePage(null, "pointers")).toBeNull();
  });
});

describe("pickCoursePage", () => {
  it("picks a page for a skill key and for a skill name", () => {
    expect(pickCoursePage(course, { skill: "pointers" })?.file).toBe(
      "lernseiten/pointers.html",
    );
    expect(pickCoursePage(course, { skill: "Call by value" })?.file).toBe(
      "lernseiten/call-by-value.html",
    );
  });

  it("scores the learner's words against the page and its skill", () => {
    expect(pickCoursePage(course, { search: "arguments" })?.file).toBe(
      "lernseiten/call-by-value.html",
    );
    expect(pickCoursePage(course, { search: "step by step" })?.file).toBe(
      "lernseiten/pointers.html",
    );
  });

  it("falls back to a page from the course instead of failing", () => {
    const picked = pickCoursePage(course, { search: "nothing matches here" });
    expect(course.lernseiten).toContain(picked);
  });

  it("returns null for a course without learning pages", () => {
    expect(pickCoursePage({ lernseiten: [] })).toBeNull();
    expect(pickCoursePage(null)).toBeNull();
  });
});

describe("pageFenceFor", () => {
  it("emits a fenced block with the language, the course and the page file", () => {
    expect(pageFenceFor(course, course.lernseiten[0])).toBe(
      [
        "```" + PAGE_FENCE_LANGUAGE,
        '{"course":"c-programmierung","page":"lernseiten/pointers.html"}',
        "```",
      ].join("\n"),
    );
  });
});

describe("formatPageToolResult", () => {
  it("names the page and returns the block, but no HTML", () => {
    const result = formatPageToolResult({
      course,
      page: course.lernseiten[0],
    });

    expect(result).toContain("Pointers step by step");
    expect(result).toContain("Pointers");
    expect(result).toContain("```" + PAGE_FENCE_LANGUAGE);
    expect(result).toContain('"page":"lernseiten/pointers.html"');
    // The page itself is loaded by the block, never carried by the model.
    expect(result).not.toContain("<html");
  });

  it("names the page's skill, or nothing when it has none", () => {
    expect(pageSkillName(course, course.lernseiten[0])).toBe("Pointers");
    expect(pageSkillName(course, { skill: "unknown" })).toBe("unknown");
    expect(pageSkillName(course, {})).toBe("");
  });
});
