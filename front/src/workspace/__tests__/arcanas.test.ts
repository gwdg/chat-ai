import { describe, expect, it } from "vitest";

import { arcanaFailureReason, classifyArcanaFiles } from "../arcanas";
import type { RagFile } from "../providers/saiaRag";

const file = (status: string): RagFile => ({
  name: "notes.md",
  status,
  chunks: 0,
  tags: [],
  markdown: false,
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

  it("accepts the splitter's success wording, not just 'indexed'", () => {
    // The service stores what `_index_chunks` produced ("Success"), and
    // `list_files` reads an empty status as "indexed".
    expect(
      classifyArcanaFiles([file("Success"), file("indexed"), file("")]),
    ).toBe("current");
    expect(classifyArcanaFiles([file("Success"), file("stored")])).toBe(
      "partial",
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

describe("arcanaFailureReason", () => {
  it("returns the service's explanation without the Failed prefix", () => {
    expect(
      arcanaFailureReason(
        "Failed: conversion: Unexpected status code 404 from http://localhost:10000/public/v1/documents/convert",
      ),
    ).toBe(
      "conversion: Unexpected status code 404 from http://localhost:10000/public/v1/documents/convert",
    );
    expect(arcanaFailureReason("Failed: unsupported format")).toBe(
      "unsupported format",
    );
  });

  it("returns nothing for a file that is pending or indexed", () => {
    expect(arcanaFailureReason("stored")).toBeNull();
    expect(arcanaFailureReason("indexed")).toBeNull();
    expect(arcanaFailureReason("Success")).toBeNull();
    expect(arcanaFailureReason("")).toBeNull();
  });
});
