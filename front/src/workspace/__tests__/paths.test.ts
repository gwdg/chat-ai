import { describe, expect, it } from "vitest";

import {
  isWithinPath,
  normalizePath,
  resolveWithin,
} from "../paths";

describe("normalizePath", () => {
  it("normalises empty, dot, and dotdot segments", () => {
    expect(normalizePath("")).toBe("/");
    expect(normalizePath(".")).toBe("/");
    expect(normalizePath("..")).toBe("/");
    expect(normalizePath("/a/.")).toBe("/a");
    expect(normalizePath("/a/b/..")).toBe("/a");
  });

  it("clamps dotdot at the root", () => {
    expect(normalizePath("/a/../../etc")).toBe("/etc");
    expect(normalizePath("../../a")).toBe("/a");
    expect(normalizePath("/../a")).toBe("/a");
  });

  it("resolves relative dotdot segments", () => {
    expect(normalizePath("a/b/../c")).toBe("/a/c");
  });

  it("treats backslashes as separators", () => {
    expect(normalizePath("\\a\\b\\..\\c")).toBe("/a/c");
  });

  it("never leaves a dotdot segment in the result", () => {
    expect(normalizePath("/a/../../b/../c").split("/")).not.toContain("..");
  });
});

describe("isWithinPath", () => {
  it("rejects a path that only looks contained before normalisation", () => {
    expect(isWithinPath("/a/../../etc", "/a")).toBe(false);
  });

  it("accepts a real descendant", () => {
    expect(isWithinPath("/a/b", "/a")).toBe(true);
  });
});

describe("resolveWithin", () => {
  it("returns the normalised path inside the root", () => {
    expect(resolveWithin("/a/b/../c", "/a")).toBe("/a/c");
    expect(resolveWithin("/a", "/a")).toBe("/a");
    expect(resolveWithin("/a/b", "/")).toBe("/a/b");
  });

  it("returns null when normalisation moves the path outside the root", () => {
    expect(resolveWithin("/a/../../etc", "/a")).toBeNull();
    expect(resolveWithin("/b", "/a")).toBeNull();
    expect(resolveWithin("/", "/a")).toBeNull();
  });
});
