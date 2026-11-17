import { describe, expect, it } from "vitest";

import { mountCoversSelection, rootHasName } from "../inWorkspace";

const mount = (sourceId: string, sourcePath: string) => ({
  sourceId,
  sourcePath,
});

const selection = (sourceId: string, path: string) => ({ sourceId, path });

describe("mountCoversSelection", () => {
  it("matches a mount at the selected path despite a trailing slash", () => {
    expect(
      mountCoversSelection([mount("drive", "/notes/")], selection("drive", "/notes")),
    ).toBe(true);
  });

  it("matches a selection below the mounted path", () => {
    expect(
      mountCoversSelection(
        [mount("drive", "/notes")],
        selection("drive", "/notes/a.txt"),
      ),
    ).toBe(true);
  });

  it("does not match a sibling that only shares the path prefix", () => {
    expect(
      mountCoversSelection(
        [mount("drive", "/notes")],
        selection("drive", "/notes2/a.txt"),
      ),
    ).toBe(false);
  });

  it("ignores a mount of another source", () => {
    expect(
      mountCoversSelection(
        [mount("other", "/notes")],
        selection("drive", "/notes/a.txt"),
      ),
    ).toBe(false);
  });

  it("matches every path below a root mount of the same source", () => {
    expect(
      mountCoversSelection(
        [mount("drive", "/")],
        selection("drive", "/deep/path.txt"),
      ),
    ).toBe(true);
  });
});

describe("rootHasName", () => {
  it("matches an exact root entry", () => {
    expect(rootHasName(new Set(["notes.txt"]), "notes.txt")).toBe(true);
  });

  it("matches a numbered collision copy", () => {
    expect(rootHasName(new Set(["notes (2).txt"]), "notes.txt")).toBe(true);
  });

  it("matches a multi-digit collision copy", () => {
    expect(rootHasName(["notes (12).txt"], "notes.txt")).toBe(true);
  });

  it("matches a numbered copy of a folder without an extension", () => {
    expect(rootHasName(new Set(["notes (2)"]), "notes")).toBe(true);
  });

  it("matches regex metacharacters literally", () => {
    expect(rootHasName(new Set(["a+b.txt"]), "a+b.txt")).toBe(true);
    expect(rootHasName(new Set(["a+b (2).txt"]), "a+b.txt")).toBe(true);
    expect(rootHasName(new Set(["aab.txt"]), "a+b.txt")).toBe(false);
  });

  it("does not match a genuinely different name", () => {
    expect(rootHasName(new Set(["notes (final).txt"]), "notes.txt")).toBe(false);
    expect(rootHasName(new Set(["notes2"]), "notes")).toBe(false);
  });
});
