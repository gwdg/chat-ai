import { describe, expect, it } from "vitest";

import { isGenericMimeType, mimeForName, resolveMimeType } from "../mime";

describe("mimeForName", () => {
  it("maps the documents a preview has to render", () => {
    expect(mimeForName("paper.pdf")).toBe("application/pdf");
    expect(mimeForName("letter.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(mimeForName("notes.md")).toBe("text/markdown");
    expect(mimeForName("report.txt")).toBe("text/plain");
    expect(mimeForName("shot.png")).toBe("image/png");
  });

  it("ignores case, directories and query-free dots", () => {
    expect(mimeForName("/a/b/PHOTO.JPG")).toBe("image/jpeg");
    expect(mimeForName("archive.final.tar.gz")).toBe("application/gzip");
    expect(mimeForName("file.")).toBeUndefined();
    expect(mimeForName(".hidden")).toBeUndefined();
    expect(mimeForName("README")).toBeUndefined();
    expect(mimeForName("")).toBeUndefined();
    expect(mimeForName(null)).toBeUndefined();
  });
});

describe("isGenericMimeType", () => {
  it("treats a missing or useless type as unknown", () => {
    expect(isGenericMimeType(undefined)).toBe(true);
    expect(isGenericMimeType("")).toBe(true);
    expect(isGenericMimeType("application/octet-stream")).toBe(true);
    expect(isGenericMimeType("binary/octet-stream")).toBe(true);
    expect(isGenericMimeType("APPLICATION/OCTET-STREAM")).toBe(true);
    expect(isGenericMimeType("application/octet-stream; charset=x")).toBe(true);
  });

  it("keeps a type that names a format", () => {
    expect(isGenericMimeType("application/pdf")).toBe(false);
    expect(isGenericMimeType("text/markdown")).toBe(false);
  });
});

describe("resolveMimeType", () => {
  it("prefers a real reported type over the name", () => {
    // A provider can know a .txt is really JSON.
    expect(resolveMimeType("data.txt", "application/json")).toBe(
      "application/json",
    );
  });

  it("falls back to the name for a generic or missing type", () => {
    expect(resolveMimeType("paper.pdf", "application/octet-stream")).toBe(
      "application/pdf",
    );
    expect(resolveMimeType("paper.pdf")).toBe("application/pdf");
    expect(resolveMimeType("README", "application/octet-stream")).toBeUndefined();
  });
});
