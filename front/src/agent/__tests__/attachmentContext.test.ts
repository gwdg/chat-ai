import { describe, expect, it } from "vitest";

import { attachmentsNote, hasReadableText } from "../attachmentContext";

describe("hasReadableText", () => {
  it("treats plain text kinds as readable without conversion", () => {
    for (const kind of ["text", "markdown", "csv", "code"]) {
      expect(hasReadableText(kind, false)).toBe(true);
    }
  });

  it("needs a text variant for binary documents", () => {
    expect(hasReadableText("pdf", false)).toBe(false);
    expect(hasReadableText("pdf", true)).toBe(true);
    expect(hasReadableText("docx", false)).toBe(false);
    expect(hasReadableText("docx", true)).toBe(true);
  });

  it("does not inline images or audio", () => {
    expect(hasReadableText("image", false)).toBe(false);
    expect(hasReadableText("audio", false)).toBe(false);
  });
});

describe("attachmentsNote", () => {
  it("returns nothing without attachments", () => {
    expect(attachmentsNote([])).toBe("");
  });

  it("lists the paths and the converted text variants for the file tools", () => {
    expect(
      attachmentsNote([
        { path: "/artefacts/a/notes.md", name: "notes.md" },
        { path: "/artefacts/b/report.pdf", name: "report.pdf", variants: ["/artefacts/b/report.pdf.md"] },
      ]),
    ).toBe(
      "\n\n[Attached files]\n- /artefacts/a/notes.md\n- /artefacts/b/report.pdf (text: /artefacts/b/report.pdf.md)",
    );
  });

  it("inlines the text of readable attachments in a named block", () => {
    const note = attachmentsNote([
      { path: "/artefacts/a/notes.md", name: "notes.md", text: "alpha beta gamma\n" },
      { path: "/artefacts/b/photo.png", name: "photo.png" },
    ]);

    expect(note).toContain("- /artefacts/a/notes.md");
    expect(note).toContain("- /artefacts/b/photo.png");
    expect(note).toContain("<attachment name=\"notes.md\">\nalpha beta gamma\n</attachment>");
    // The image has no text, so it only appears in the path list.
    expect(note).not.toContain('<attachment name="photo.png">');
  });

  it("skips an attachment whose extracted text is empty", () => {
    const note = attachmentsNote([{ path: "/artefacts/a/notes.md", name: "notes.md", text: "   " }]);
    expect(note).toBe("\n\n[Attached files]\n- /artefacts/a/notes.md");
  });
});
