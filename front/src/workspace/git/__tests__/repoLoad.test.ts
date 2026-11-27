import { describe, expect, it, vi } from "vitest";

// A bundle built without the library keeps the bare specifier, and the browser
// rejects the import with exactly this message.
vi.mock("isomorphic-git", () => {
  throw new Error('Failed to resolve module specifier "isomorphic-git"');
});
vi.mock("isomorphic-git/http/web", () => {
  throw new Error("the Git HTTP client is not installed");
});

import { GitError, loadGit } from "../repo";

describe("loadGit", () => {
  it("turns an unloadable Git library into an actionable error", async () => {
    const failure = await loadGit().catch((error) => error);
    expect(failure).toBeInstanceOf(GitError);
    expect(failure).toMatchObject({ code: "GIT_UNAVAILABLE" });
  });

  it("does not cache the failure, so a reload can retry", async () => {
    const first = await loadGit().catch((error) => error);
    const second = await loadGit().catch((error) => error);
    expect(second).toBeInstanceOf(GitError);
    expect(second).not.toBe(first);
  });
});
