import { describe, expect, it } from "vitest";

import {
  isTextFileName,
  parseSearchResults,
} from "../providers/saiaRag";

// The saia-rag search tools render plain text, not JSON. The parser is the
// only thing between that text and the result list, so every shape it can
// receive is pinned here.
describe("parseSearchResults", () => {
  it("splits chunks that carry a filename and a score", () => {
    const results = parseSearchResults(
      "[notes.md score=0.870]\nfirst chunk\n\n[paper.pdf score=0.310]\nsecond chunk",
      "chunks",
    );
    expect(results).toEqual([
      { filename: "notes.md", score: 0.87, text: "first chunk" },
      { filename: "paper.pdf", score: 0.31, text: "second chunk" },
    ]);
  });

  it("splits previews into numbered hits with their snippet", () => {
    const results = parseSearchResults(
      "1. notes.md (score=0.870)\n# hi\n\n2. paper.pdf (score=0.310)\n%PDF",
      "previews",
    );
    expect(results).toEqual([
      { filename: "notes.md", score: 0.87, text: "# hi" },
      { filename: "paper.pdf", score: 0.31, text: "%PDF" },
    ]);
  });

  it("reads the document ranking, which has no snippet", () => {
    const results = parseSearchResults(
      "1. notes.md (score=0.870)\n2. paper.pdf (score=0.310)",
      "documents",
    );
    expect(results).toEqual([
      { filename: "notes.md", score: 0.87, text: "" },
      { filename: "paper.pdf", score: 0.31, text: "" },
    ]);
  });

  it("treats the service's empty answers as no results", () => {
    expect(parseSearchResults("No results found.", "chunks")).toEqual([]);
    expect(parseSearchResults("No matching documents found.", "previews")).toEqual(
      [],
    );
    expect(parseSearchResults("", "chunks")).toEqual([]);
  });
});

describe("isTextFileName", () => {
  it("recognises the text formats the service can index", () => {
    for (const name of ["notes.md", "README.TXT", "data.csv", "main.py"]) {
      expect(isTextFileName(name)).toBe(true);
    }
  });

  it("does not call a binary or unnamed file text", () => {
    for (const name of ["paper.pdf", "image.png", "archive.zip", "README", ""]) {
      expect(isTextFileName(name)).toBe(false);
    }
  });
});
