import { describe, expect, it } from "vitest";

import { entriesForAction } from "../selection";

const entry = (sourceId, path) => ({
  sourceId,
  path,
  name: path.split("/").pop(),
  kind: "file",
  local: true,
});

describe("entriesForAction", () => {
  it("acts on a single entry when nothing is selected", () => {
    const dragged = entry("source", "/a.txt");
    expect(entriesForAction(dragged, [])).toEqual([dragged]);
  });

  it("carries the whole selection when the entry is selected", () => {
    const selected = [
      entry("source", "/a.txt"),
      entry("source", "/b.txt"),
      entry("source", "/folder"),
    ];
    expect(entriesForAction(selected[1], selected)).toBe(selected);
  });

  it("acts only on the entry when it is not part of the selection", () => {
    const selected = [entry("source", "/a.txt")];
    const other = entry("source", "/c.txt");
    expect(entriesForAction(other, selected)).toEqual([other]);
  });

  it("compares the source as well as the path", () => {
    const selected = [entry("other-source", "/a.txt")];
    const samePath = entry("source", "/a.txt");
    expect(entriesForAction(samePath, selected)).toEqual([samePath]);
  });
});
