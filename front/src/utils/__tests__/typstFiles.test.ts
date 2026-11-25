import { describe, expect, it, vi } from "vitest";
import {
  collectTypstFiles,
  isTypstFileName,
  resolveTypstPath,
  typstFileReferences,
  typstSignature,
} from "../typstFiles";

const bytes = (text) => new TextEncoder().encode(text);

describe("isTypstFileName", () => {
  it("matches the Typst extensions and MIME types", () => {
    expect(isTypstFileName("report.typ", "application/octet-stream")).toBe(true);
    expect(isTypstFileName("report.TYPST", null)).toBe(true);
    expect(isTypstFileName(null, "text/typst")).toBe(true);
    expect(isTypstFileName(null, "application/x-typst")).toBe(true);
    expect(isTypstFileName("report.typ.txt", "text/plain")).toBe(false);
    expect(isTypstFileName("report.md", "text/markdown")).toBe(false);
  });
});

describe("typstFileReferences", () => {
  it("finds the documented loaders and imports", () => {
    const source = [
      '#import "utils.typ": *',
      '#include "chapter.typ"',
      '#include("/appendix.typ")',
      '#image("figures/plot.png")',
      '#read("raw.txt")',
      '#csv("data.csv")',
      '#json("data.json")',
      '#yaml("data.yaml")',
      '#toml("data.toml")',
      '#cbor("data.cbor")',
      '#bibliography(("a.bib", "b.bib"))',
    ].join("\n");

    expect(typstFileReferences(source)).toEqual([
      "utils.typ",
      "chapter.typ",
      "/appendix.typ",
      "figures/plot.png",
      "raw.txt",
      "data.csv",
      "data.json",
      "data.yaml",
      "data.toml",
      "data.cbor",
      "a.bib",
    ]);
  });

  it("ignores plain text and code that only mentions a loader", () => {
    expect(typstFileReferences("= Hello\nA normal sentence.")).toEqual([]);
    expect(typstFileReferences('#text("not a file")')).toEqual([]);
  });
});

describe("resolveTypstPath", () => {
  it("resolves relative references against the referencing directory", () => {
    expect(resolveTypstPath("/", "chapter.typ")).toBe("/chapter.typ");
    expect(resolveTypstPath("/chapters", "one.typ")).toBe("/chapters/one.typ");
    expect(resolveTypstPath("/chapters", "sub/one.typ")).toBe(
      "/chapters/sub/one.typ",
    );
    expect(resolveTypstPath("/chapters", "../shared.typ")).toBe("/shared.typ");
  });

  it("treats a leading slash as the compile root", () => {
    expect(resolveTypstPath("/chapters", "/shared.typ")).toBe("/shared.typ");
    expect(resolveTypstPath("/chapters", "/figures/a.png")).toBe(
      "/figures/a.png",
    );
  });

  it("rejects what is not a readable file", () => {
    expect(resolveTypstPath("/", "https://example.org/a.typ")).toBeNull();
    expect(resolveTypstPath("/", "data:text/plain,hi")).toBeNull();
    expect(resolveTypstPath("/", "@preview/cetz:0.2.0")).toBeNull();
    expect(resolveTypstPath("/", "")).toBeNull();
    expect(resolveTypstPath("/", "../outside.typ")).toBeNull();
  });
});

describe("collectTypstFiles", () => {
  it("reads every reference and recurses into included Typst files", async () => {
    const tree = new Map([
      ["/chapter.typ", bytes('#include "details.typ"\n= Chapter')],
      ["/details.typ", bytes("= Details")],
      ["/logo.png", new Uint8Array([1, 2, 3])],
      ["/refs.bib", bytes("@book{a}")],
    ]);
    const resolveFile = vi.fn(async (path) => tree.get(path) ?? null);

    const result = await collectTypstFiles(
      '#include "chapter.typ"\n#image("logo.png")\n#bibliography("refs.bib")',
      { resolveFile },
    );

    expect(result.files.map((file) => file.path).sort()).toEqual([
      "/chapter.typ",
      "/details.typ",
      "/logo.png",
      "/refs.bib",
    ]);
    expect(result.missing).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(resolveFile).toHaveBeenCalledWith("/details.typ");
  });

  it("reports references the resolver cannot read and keeps going", async () => {
    const resolveFile = async (path) =>
      path === "/present.png" ? new Uint8Array([9]) : null;

    const result = await collectTypstFiles(
      '#image("present.png")\n#include "missing.typ"\n#include "missing.typ"',
      { resolveFile },
    );

    expect(result.files.map((file) => file.path)).toEqual(["/present.png"]);
    // A path referenced twice is read (and reported) once.
    expect(result.missing).toEqual(["/missing.typ"]);
  });

  it("treats a throwing resolver as a missing file", async () => {
    const result = await collectTypstFiles('#image("x.png")', {
      resolveFile: async () => {
        throw new Error("denied");
      },
    });

    expect(result.files).toEqual([]);
    expect(result.missing).toEqual(["/x.png"]);
  });

  it("stops at the size cap and says so", async () => {
    const resolveFile = async () => new Uint8Array(64);

    const result = await collectTypstFiles(
      '#image("a.png")\n#image("b.png")\n#image("c.png")',
      { resolveFile, maxBytes: 100 },
    );

    expect(result.files.length).toBe(2);
    expect(result.truncated).toBe(true);
  });

  it("has nothing to read without a resolver", async () => {
    const result = await collectTypstFiles('#image("a.png")');
    expect(result).toEqual({ files: [], missing: [], truncated: false });
  });
});

describe("typstSignature", () => {
  it("is the source itself when the document loads no files", () => {
    expect(typstSignature("= Hello", [])).toBe("= Hello");
  });

  it("changes when a loaded file changes", () => {
    const one = typstSignature("= Hi", [
      { path: "/a.png", data: new Uint8Array([1]) },
    ]);
    const other = typstSignature("= Hi", [
      { path: "/a.png", data: new Uint8Array([2]) },
    ]);

    expect(one).not.toBe(other);
    expect(one.startsWith("= Hi")).toBe(true);
  });
});
