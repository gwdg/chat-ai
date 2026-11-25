import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearEditorDraft,
  editorDraftKey,
  editorDraftsVersion,
  getEditorDraft,
  hasEditorDraft,
  resetEditorDrafts,
  setEditorDraft,
  subscribeEditorDrafts,
} from "../editorDrafts";

beforeEach(() => {
  resetEditorDrafts();
});

describe("editorDraftKey", () => {
  it("keeps two sources and two files apart", () => {
    expect(editorDraftKey("ws-1", "root", "/a.txt")).not.toBe(
      editorDraftKey("ws-1", "root", "/b.txt"),
    );
    expect(editorDraftKey("ws-1", "root", "/a.txt")).not.toBe(
      editorDraftKey("ws-1", "dev-1", "/a.txt"),
    );
    expect(editorDraftKey("ws-1", "root", "/a.txt")).not.toBe(
      editorDraftKey("ws-2", "root", "/a.txt"),
    );
  });

  it("treats identical coordinates as the same key", () => {
    expect(editorDraftKey("ws-1", "root", "/a.txt")).toBe(
      editorDraftKey("ws-1", "root", "/a.txt"),
    );
  });
});

describe("editor drafts", () => {
  it("holds text until it differs from the saved base", () => {
    setEditorDraft("k", { text: "changed", base: "saved" });

    expect(hasEditorDraft("k")).toBe(true);
    expect(getEditorDraft("k")).toEqual({ text: "changed", base: "saved" });
  });

  it("drops a draft that matches its base again", () => {
    setEditorDraft("k", { text: "changed", base: "saved" });
    setEditorDraft("k", { text: "saved", base: "saved" });

    expect(hasEditorDraft("k")).toBe(false);
  });

  it("clears a draft after a save", () => {
    setEditorDraft("k", { text: "changed", base: "saved" });
    clearEditorDraft("k");

    expect(getEditorDraft("k")).toBeUndefined();
  });

  it("tells subscribers when a draft appears or disappears", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeEditorDrafts(listener);

    setEditorDraft("k", { text: "a", base: "b" });
    expect(listener).toHaveBeenCalledTimes(1);

    // A keystroke in an already dirty file is invisible to the tree.
    setEditorDraft("k", { text: "ab", base: "b" });
    expect(listener).toHaveBeenCalledTimes(1);

    setEditorDraft("k", { text: "b", base: "b" });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setEditorDraft("k2", { text: "a", base: "b" });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("bumps the version only for a visible change", () => {
    const version = editorDraftsVersion();

    setEditorDraft("k", { text: "a", base: "b" });
    const appeared = editorDraftsVersion();
    expect(appeared).toBeGreaterThan(version);

    setEditorDraft("k", { text: "ac", base: "b" });
    expect(editorDraftsVersion()).toBe(appeared);
  });
});
