import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPersona,
  getPersonaDownloadUrl,
  getPersonaMarkers,
  hasPersonaStartLink,
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
          tree: [{ path: "writing/editor.json", type: "blob" }],
        }),
        { status: 200 },
      ),
    );

    const personas = await loadPersonaCatalog({ force: true });
    expect(personas).toEqual([
      expect.objectContaining({ id: "writing/editor.json", title: "editor" }),
    ]);
  });
});
