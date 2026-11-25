import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchPersona: vi.fn(),
}));

vi.mock("../personaCatalog", () => ({
  fetchPersona: mocks.fetchPersona,
}));

import {
  clearCourseCache,
  coursePersonaPath,
  ensureCourse,
  loadCourse,
  loadCourseDocument,
} from "../courseCatalog";

const SKILLS = JSON.stringify({
  topics: [{ key: "t", name: "Topic" }],
  skills: [{ key: "s", topic_key: "t", name: "Skill" }],
});
const QUIZ = JSON.stringify({
  questions: [
    { type: "single_choice", question: "Q", answers: ["A"], correct: [1], skills: ["s"] },
  ],
});

const personaData = {
  title: "C-Programmierung",
  subtitle: "A course",
  messages: [{ role: "system", content: "Tutor" }],
  course: {
    id: "c-programmierung",
    title: "C",
    language: "de",
    baseUrl: "c-programmierung/",
    skills: "skills.json",
    quiz: "quiz.json",
    overviews: { skills: "skills.html", quiz: "quiz.html" },
    lernseiten: [
      { skill: "s", file: "lernseiten/page.html", title: "Page one" },
      "lernseiten/two.html",
    ],
  },
};

function mockFetch() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const text = String(url);
    if (text.endsWith("/skills.json")) {
      return new Response(SKILLS, { status: 200 });
    }
    if (text.endsWith("/quiz.json")) {
      return new Response(QUIZ, { status: 200 });
    }
    if (text.endsWith("/page.html")) {
      return new Response("<html>page</html>", { status: 200 });
    }
    return new Response("missing", { status: 404 });
  });
}

beforeEach(() => {
  clearCourseCache();
  mocks.fetchPersona.mockReset();
  vi.restoreAllMocks();
});

describe("courseCatalog paths", () => {
  it("maps a course id to its persona path and rejects traversal", () => {
    expect(coursePersonaPath("c-programmierung")).toBe(
      "courses/c-programmierung.json",
    );
    expect(coursePersonaPath("courses/x.json")).toBe("courses/x.json");
    expect(() => coursePersonaPath("../x")).toThrow();
    expect(() => coursePersonaPath("courses//x.json")).toThrow();
  });
});
describe("loadCourse", () => {
  it("resolves assets from baseUrl and normalizes the course", async () => {
    mocks.fetchPersona.mockResolvedValue({
      entry: {
        title: "C-Programmierung",
        description: "A course",
        category: "courses",
        url: "https://raw.example/repo/main/courses/c-programmierung.json",
      },
      data: personaData,
    });
    mockFetch();

    const course = await loadCourse("c-programmierung");

    expect(course.id).toBe("c-programmierung");
    expect(course.title).toBe("C");
    expect(course.baseUrl).toBe(
      "https://raw.example/repo/main/courses/c-programmierung/",
    );
    expect(course.overviews).toEqual({
      skills:
        "https://raw.example/repo/main/courses/c-programmierung/skills.html",
      quiz: "https://raw.example/repo/main/courses/c-programmierung/quiz.html",
    });
    expect(course.lernseiten).toEqual([
      expect.objectContaining({ skill: "s", title: "Page one" }),
      expect.objectContaining({ skill: "", title: "two" }),
    ]);
    expect(course.questions).toHaveLength(1);
    expect(course.stats.questions).toBe(1);
  });

  it("caches a loaded course until cleared", async () => {
    mocks.fetchPersona.mockResolvedValue({
      entry: { url: "https://raw.example/courses/c.json" },
      data: personaData,
    });
    mockFetch();

    await loadCourse("c");
    await loadCourse("c");

    expect(mocks.fetchPersona).toHaveBeenCalledTimes(1);
  });

  it("refuses a persona without a course block", async () => {
    mocks.fetchPersona.mockResolvedValue({
      entry: { url: "https://raw.example/courses/c.json" },
      data: { title: "Plain persona" },
    });

    await expect(loadCourse("c")).rejects.toThrow("NOT_A_COURSE");
  });

  it("caches fetched documents", async () => {
    mockFetch();

    const first = await loadCourseDocument("https://raw.example/page.html");
    const second = await loadCourseDocument("https://raw.example/page.html");

    expect(first).toBe("<html>page</html>");
    expect(second).toBe(first);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("ensureCourse", () => {
  it("shares one load between concurrent callers", async () => {
    mocks.fetchPersona.mockResolvedValue({
      entry: { url: "https://raw.example/courses/c.json" },
      data: personaData,
    });
    mockFetch();

    const [first, second] = await Promise.all([
      ensureCourse("c"),
      ensureCourse("c"),
    ]);

    expect(first).toBe(second);
    expect(mocks.fetchPersona).toHaveBeenCalledTimes(1);
  });

  it("forgets a failed load, so the next attempt can succeed", async () => {
    mocks.fetchPersona.mockRejectedValueOnce(new Error("offline"));
    await expect(ensureCourse("c")).rejects.toThrow("offline");

    mocks.fetchPersona.mockResolvedValue({
      entry: { url: "https://raw.example/courses/c.json" },
      data: personaData,
    });
    mockFetch();

    const course = await ensureCourse("c");
    expect(course.id).toBe("c-programmierung");
  });
});
