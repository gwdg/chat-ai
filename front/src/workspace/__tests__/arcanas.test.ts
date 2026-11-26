import { describe, expect, it } from "vitest";

import { classifyArcanaFiles } from "../arcanas";
import type { RagFile } from "../providers/saiaRag";

const file = (status: string): RagFile => ({
  name: "notes.md",
  status,
  chunks: 0,
  tags: [],
});

// The sidebar shows one dot per collection, so this classification is the
// whole signal: it has to agree with what the manager's file rows say.
describe("classifyArcanaFiles", () => {
  it("treats a collection with nothing to index as current", () => {
    expect(classifyArcanaFiles([])).toBe("current");
  });

  it("is current when every file is indexed", () => {
    expect(classifyArcanaFiles([file("indexed"), file("indexed")])).toBe(
      "current",
    );
  });

  it("is pending when no file is indexed", () => {
    expect(classifyArcanaFiles([file("stored"), file("stored")])).toBe(
      "pending",
    );
  });

  it("counts a failed file as not indexed", () => {
    expect(classifyArcanaFiles([file("Failed: no text")])).toBe("pending");
    expect(
      classifyArcanaFiles([file("indexed"), file("Failed: no text")]),
    ).toBe("partial");
  });

  it("is partial while some files are still waiting", () => {
    expect(classifyArcanaFiles([file("indexed"), file("stored")])).toBe(
      "partial",
    );
  });
});
