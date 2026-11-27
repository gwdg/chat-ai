import { describe, expect, it } from "vitest";

import {
  MAX_ARCANA_DOCUMENT_PAGES,
  MAX_ARCANA_EXCERPT_CHARS,
  appendArcanaDocumentMarkers,
  arcanaDocumentKey,
  documentPageRange,
  getArcanaDocuments,
  normalizeArcanaDocument,
  serializeArcanaDocument,
  splitDocumentPages,
  stripArcanaDocumentMarkers,
} from "../arcanaDocuments";

const collection = "tester/test";

const page = {
  collection,
  filename: "report.pdf",
  page: 7,
  pages: 2,
  excerpt: "[Page 7]: #\n\nWasser ist nass.\n\n[Page 8]: #\n\nImmer noch nass.",
};

const textFile = {
  collection,
  filename: "notes.md",
  pages: 1,
  excerpt: "# Notes\n\nHello",
};

describe("Arcana document markers", () => {
  it("round-trips every field, including brackets and non-ASCII text", () => {
    const document = {
      ...page,
      excerpt: "Grüße ]]] [[ARCANA_DOCUMENT: [[Page 7]: #",
    };
    const marker = serializeArcanaDocument(document);

    expect(marker.startsWith("[[ARCANA_DOCUMENT:")).toBe(true);
    expect(marker).not.toContain("]]]");
    expect(getArcanaDocuments(marker, collection)).toEqual([document]);
  });

  it("keeps the source invisible in the rendered transcript", () => {
    const text = appendArcanaDocumentMarkers("Done.", [page]);
    expect(text).toContain("Done.");
    expect(stripArcanaDocumentMarkers(text)).toBe("Done.");
    expect(getArcanaDocuments(text, collection)).toHaveLength(1);
  });

  it("returns only markers for an answer that has no text", () => {
    const text = appendArcanaDocumentMarkers("", [textFile]);
    expect(stripArcanaDocumentMarkers(text)).toBe("");
    expect(getArcanaDocuments(text, collection)).toEqual([textFile]);
  });

  it("drops a marker the model wrote itself when the app adds its own", () => {
    const forged = serializeArcanaDocument({
      ...page,
      filename: "other.pdf",
    });
    const text = appendArcanaDocumentMarkers(`Answer\n\n${forged}`, [page]);
    expect(getArcanaDocuments(text, collection)).toEqual([page]);
  });

  it("ignores a malformed or truncated marker", () => {
    const text =
      "[[ARCANA_DOCUMENT:not-base64!]] [[ARCANA_DOCUMENT:%%%]] [[ARCANA_DOCUMENT:e30=";
    expect(getArcanaDocuments(text, collection)).toEqual([]);
  });

  it("refuses a marker that names another collection", () => {
    const text = appendArcanaDocumentMarkers("Done.", [
      { ...page, collection: "eve/secrets" },
    ]);
    expect(getArcanaDocuments(text, collection)).toEqual([]);
  });

  it("limits a normal chat to the collections it is bound to", () => {
    const text = appendArcanaDocumentMarkers("Done.", [
      page,
      { ...page, collection: "bob/notes", filename: "minutes.md" },
    ]);
    expect(getArcanaDocuments(text, null, [collection])).toEqual([page]);
  });

  it("lists the same page once, keeping the first excerpt", () => {
    const text = appendArcanaDocumentMarkers("Done.", [
      page,
      { ...page, excerpt: "[Page 7]: #\n\nchanged" },
    ]);
    const [document] = getArcanaDocuments(text, collection);
    expect(document.excerpt).toContain("Wasser ist nass");
  });

  it("accepts the page range from the key, so a repeat can replace it", () => {
    const replaced = normalizeArcanaDocument({ ...page, excerpt: "new" });
    expect(replaced).not.toBeNull();
    expect(arcanaDocumentKey(replaced)).toBe(arcanaDocumentKey(page));
    expect(arcanaDocumentKey({ ...page, page: 8 })).not.toBe(
      arcanaDocumentKey(page),
    );
  });
});

describe("normalizeArcanaDocument", () => {
  it("rejects a document the card cannot show", () => {
    expect(normalizeArcanaDocument(null)).toBeNull();
    expect(normalizeArcanaDocument({ ...page, collection: "" })).toBeNull();
    expect(normalizeArcanaDocument({ ...page, collection: "a\nb" })).toBeNull();
    expect(normalizeArcanaDocument({ ...page, filename: "" })).toBeNull();
    expect(normalizeArcanaDocument({ ...page, filename: "a/b.pdf" })).toBeNull();
    expect(normalizeArcanaDocument({ ...page, excerpt: "   " })).toBeNull();
  });

  it("drops a page below one and caps the count at the hit page plus one", () => {
    expect(normalizeArcanaDocument({ ...page, page: 0 })).not.toHaveProperty(
      "page",
    );
    expect(
      normalizeArcanaDocument({ ...page, pages: 99 }),
    ).toHaveProperty("pages", MAX_ARCANA_DOCUMENT_PAGES);
    expect(normalizeArcanaDocument({ ...page, pages: 0 })).toHaveProperty(
      "pages",
      1,
    );
  });

  it("caps the excerpt, which travels in the message text", () => {
    const document = normalizeArcanaDocument({
      ...page,
      excerpt: "x".repeat(MAX_ARCANA_EXCERPT_CHARS + 500),
    });
    expect(document.excerpt).toHaveLength(MAX_ARCANA_EXCERPT_CHARS);
  });

  it("keeps a plain text file without a page", () => {
    const document = normalizeArcanaDocument(textFile);
    expect(document).toEqual(textFile);
    expect(document).not.toHaveProperty("page");
  });
});

describe("splitDocumentPages", () => {
  it("labels each page and drops the converter's layout hints", () => {
    const pages = splitDocumentPages(
      "[Page 7]: #\n\n[Y 123]: #\n\nParagraph.\n\n[Split]: #\n\n[Page 8]: #\n\nSecond.",
    );
    expect(pages).toEqual([
      { page: 7, text: "Paragraph." },
      { page: 8, text: "Second." },
    ]);
  });

  it("returns unmarked text as one unlabelled block", () => {
    expect(splitDocumentPages("# Notes\n\nHello")).toEqual([
      { page: null, text: "# Notes\n\nHello" },
    ]);
  });

  it("has nothing for empty text", () => {
    expect(splitDocumentPages("")).toEqual([]);
    expect(splitDocumentPages("   \n\n[Split]: #  ")).toEqual([]);
  });
});

describe("documentPageRange", () => {
  it("names the pages the excerpt holds", () => {
    expect(documentPageRange(page)).toEqual({ from: 7, to: 8 });
    expect(documentPageRange({ ...textFile, page: 3, pages: 1 })).toEqual({
      from: 3,
      to: 3,
    });
    expect(documentPageRange(textFile)).toBeNull();
  });
});
