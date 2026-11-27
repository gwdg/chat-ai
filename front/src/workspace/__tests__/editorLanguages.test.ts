import { describe, expect, it } from "vitest";

import {
  editorLanguageFor,
  loadEditorLanguage,
} from "../editorLanguages";

describe("editorLanguageFor", () => {
  it("maps the common extensions to their grammar", () => {
    expect(editorLanguageFor("main.py")).toBe("python");
    expect(editorLanguageFor("app.tsx")).toBe("tsx");
    expect(editorLanguageFor("app.jsx")).toBe("jsx");
    expect(editorLanguageFor("package.json")).toBe("json");
    expect(editorLanguageFor("index.html")).toBe("html");
    expect(editorLanguageFor("style.css")).toBe("css");
    expect(editorLanguageFor("README.md")).toBe("markdown");
    expect(editorLanguageFor("main.rs")).toBe("rust");
    expect(editorLanguageFor("deploy.sh")).toBe("shell");
    expect(editorLanguageFor("Cargo.toml")).toBe("toml");
    expect(editorLanguageFor("paper.tex")).toBe("latex");
  });

  it("reads the extension of the file, not of a folder above it", () => {
    expect(editorLanguageFor("/home/user/app/main.py")).toBe("python");
    expect(editorLanguageFor("C:\\code\\main.py")).toBe("python");
  });

  it("ignores the case of the extension", () => {
    expect(editorLanguageFor("Main.PY")).toBe("python");
  });

  it("falls back to plain text for an unknown or missing extension", () => {
    expect(editorLanguageFor("notes")).toBe("plain");
    expect(editorLanguageFor("data.unknownext")).toBe("plain");
    expect(editorLanguageFor("archive.")).toBe("plain");
    expect(editorLanguageFor(undefined)).toBe("plain");
  });

  it("does not treat every dotfile as an unknown extension", () => {
    // `.env` is a properties file, while a name like `.gitignore` has no grammar.
    expect(editorLanguageFor(".env")).toBe("properties");
    expect(editorLanguageFor(".gitignore")).toBe("plain");
  });
});

describe("loadEditorLanguage", () => {
  it("resolves plain text to no extension at all", async () => {
    await expect(loadEditorLanguage("plain")).resolves.toEqual([]);
  });

  it("loads the grammar a file asks for", async () => {
    const extension = await loadEditorLanguage("python");

    expect(extension).toBeTruthy();
    expect(Array.isArray(extension)).toBe(false);
  });
});
