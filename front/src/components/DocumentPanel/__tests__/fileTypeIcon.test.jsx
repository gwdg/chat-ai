import { describe, expect, it } from "vitest";
import {
  Document,
  DocumentPdf,
  DocumentWordProcessor,
  Markdown,
} from "@carbon/icons-react";

import { fileTypeIcon } from "../fileTypeIcon";

// The preview header, the Arcana file list and a cited source card all ask this one
// helper, so its mapping is the contract that keeps them from disagreeing.
describe("fileTypeIcon", () => {
  it("gives a Markdown file the Markdown icon", () => {
    expect(fileTypeIcon("notes.md")).toEqual({
      type: "markdown",
      Icon: Markdown,
    });
    // The reported type wins over the name, exactly as in the preview body.
    expect(fileTypeIcon("readme", "text/markdown").type).toBe("markdown");
  });

  it("classifies a PDF by name when the provider reports no MIME type", () => {
    expect(fileTypeIcon("report.pdf")).toEqual({
      type: "pdf",
      Icon: DocumentPdf,
    });
  });

  it("recognises a Word document from the name alone", () => {
    expect(fileTypeIcon("paper.docx").Icon).toBe(DocumentWordProcessor);
  });

  it("falls back to the generic sheet for a type it cannot name", () => {
    const result = fileTypeIcon("archive.zip");

    expect(result.type).toBe("unknown");
    expect(result.Icon).toBe(Document);
  });
});
