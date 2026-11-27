import { describe, expect, it } from "vitest";

import {
  isTextFileName,
  markdownFileName,
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

  it("reads the page of a converted document's chunk", () => {
    const results = parseSearchResults(
      "[report.pdf p.7 score=0.512]\npassage\n\n[notes.md score=0.400]\ntext",
      "chunks",
    );
    expect(results).toEqual([
      { filename: "report.pdf", page: 7, score: 0.512, text: "passage" },
      { filename: "notes.md", score: 0.4, text: "text" },
    ]);
    // A plain text file has no page, so the field is absent rather than 0.
    expect(results[1]).not.toHaveProperty("page");
  });

  it("does not mistake a 'p.' in the file name for a page", () => {
    const [result] = parseSearchResults(
      "[chapter p.4.pdf score=0.5]\npassage",
      "chunks",
    );
    expect(result).toEqual({
      filename: "chapter p.4.pdf",
      score: 0.5,
      text: "passage",
    });
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

describe("markdownFileName", () => {
  it("replaces the original extension, because the bytes are Markdown now", () => {
    expect(markdownFileName("Wasserwerksschulung.pdf")).toBe(
      "Wasserwerksschulung.md",
    );
    expect(markdownFileName("lecture.docx")).toBe("lecture.md");
  });

  it("appends the extension to a name that has none", () => {
    expect(markdownFileName("README")).toBe("README.md");
    expect(markdownFileName(".env")).toBe(".env.md");
  });
});
