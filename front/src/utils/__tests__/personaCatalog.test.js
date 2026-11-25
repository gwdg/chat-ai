import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPersona,
  getPersonaDownloadUrl,
  getPersonaMarkers,
  hasPersonaStartLink,
  isCourseAssetPath,
  isIgnoredPersonaFolder,
  isIgnoredPersonaPath,
  loadPersonaCatalog,
  parsePersonaText,
  PERSONA_MARKER_PATTERN,
  stripPersonaMarkers,
} from "../personaCatalog";

describe("persona catalog", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("parses JSON with trailing commas and builds download URLs", () => {
    expect(parsePersonaText('{"title":"Editor",}')).toEqual({ title: "Editor" });
    expect(getPersonaDownloadUrl("writing/editor.json")).toContain(
      "/writing/editor.json",
    );
    expect(() => getPersonaDownloadUrl("../secret.json")).toThrow();
  });

  it("parses and strips persona markers and links", () => {
    const text = "Try [[PERSONA:a/b.json]] and [start](/persona/c/d.json).";
    expect(getPersonaMarkers(text)).toEqual(["a/b.json"]);
    expect(hasPersonaStartLink(text)).toBe(true);
    expect(PERSONA_MARKER_PATTERN.test("[[PERSONA:x.json]]")).toBe(true);
    expect(stripPersonaMarkers(text)).not.toContain("PERSONA");
  });

  it("ignores folders starting with an underscore", () => {
    expect(isIgnoredPersonaFolder("_tests")).toBe(true);
    expect(isIgnoredPersonaFolder("_drafts")).toBe(true);
    expect(isIgnoredPersonaFolder("writing")).toBe(false);

    expect(isIgnoredPersonaPath("_tests/report.json")).toBe(true);
    expect(isIgnoredPersonaPath("writing/_drafts/editor.json")).toBe(true);
    expect(isIgnoredPersonaPath("writing/editor.json")).toBe(false);
  });

  it("treats nested course JSON as material, not as a persona", () => {
    expect(isCourseAssetPath("courses/c/skills.json")).toBe(true);
    expect(isCourseAssetPath("courses/c/nested/quiz.json")).toBe(true);
    expect(isCourseAssetPath("courses/c.json")).toBe(false);
    expect(isCourseAssetPath("writing/editor.json")).toBe(false);
  });

  it("fetches a persona and caches it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"title":"Tutor","subtitle":"Helps study"}', { status: 200 }),
    );

    const result = await fetchPersona("learning/tutor.json");
    expect(result.entry.title).toBe("Tutor");
    expect(result.entry.description).toBe("Helps study");
  });

  it("loads the catalog from the GitHub tree API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          tree: [
            { path: "writing/editor.json", type: "blob" },
            { path: "_tests/report.json", type: "blob" },
            { path: "writing/_drafts/editor.json", type: "blob" },
          ],
        }),
        { status: 200 },
      ),
    );

    const personas = await loadPersonaCatalog({ force: true });
    expect(personas).toEqual([
      expect.objectContaining({ id: "writing/editor.json", title: "editor" }),
    ]);
  });

  it("lists a course persona once and exposes its course block", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("api.github.com")) {
        return new Response(
          JSON.stringify({
            tree: [
              { path: "courses/c-programmierung.json", type: "blob" },
              { path: "courses/c-programmierung/skills.json", type: "blob" },
              { path: "courses/c-programmierung/quiz.json", type: "blob" },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          title: "C-Programmierung",
          course: { id: "c-programmierung", title: "C course" },
        }),
        { status: 200 },
      );
    });

    const personas = await loadPersonaCatalog({ force: true });

    expect(personas).toHaveLength(1);
    expect(personas[0]).toMatchObject({
      path: "courses/c-programmierung.json",
      course: { id: "c-programmierung", title: "C course" },
    });
  });
});
