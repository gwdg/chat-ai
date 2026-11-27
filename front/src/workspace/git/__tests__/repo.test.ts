import { afterEach, describe, expect, it } from "vitest";

import { readAll, streamOf } from "../../bytes";
import {
  checkoutGitBranch,
  commitGitChanges,
  createGitBranch,
  deleteGitBranch,
  discardGitChanges,
  initGitRepository,
  isGitRepository,
  listGitBranches,
  readGitLog,
  readGitStatus,
  stageGitFiles,
  unstageGitFiles,
  GitError,
} from "../repo";
import { createMemoryProvider } from "./memoryProvider";
import type { FileProvider } from "../../providers/types";

const identity = { name: "Tester", email: "tester@example.org" };

const text = async (provider: FileProvider, path: string) =>
  new TextDecoder().decode(await readAll(await provider.read(path)));

const write = (provider: FileProvider, path: string, value: string) =>
  provider.write(path, streamOf(value), { overwrite: true });

afterEach(() => {
  localStorage.clear();
});

describe("workspace Git repository", () => {
  it("initialises, stages, commits and reports a clean tree", async () => {
    const provider = createMemoryProvider();
    await provider.mkdir("/repo");

    expect(await isGitRepository(provider, "/repo")).toBe(false);
    await initGitRepository(provider, "/repo");
    expect(await isGitRepository(provider, "/repo")).toBe(true);

    const empty = await readGitStatus(provider, "/repo");
    expect(empty.branch).toBe("main");
    expect(empty.clean).toBe(true);

    await write(provider, "/repo/a.txt", "hello\n");
    const untracked = await readGitStatus(provider, "/repo");
    expect(untracked.files).toHaveLength(1);
    expect(untracked.files[0]).toMatchObject({
      path: "a.txt",
      untracked: true,
      unstaged: true,
    });

    await stageGitFiles(provider, "/repo");
    const staged = await readGitStatus(provider, "/repo");
    expect(staged.files[0]).toMatchObject({
      path: "a.txt",
      index: "A",
      staged: true,
    });

    // On an unborn branch, unstaging removes the entry again instead of leaving
    // a staged add behind.
    await unstageGitFiles(provider, "/repo", ["a.txt"]);
    expect((await readGitStatus(provider, "/repo")).files[0]).toMatchObject({
      path: "a.txt",
      untracked: true,
    });
    await stageGitFiles(provider, "/repo");

    await commitGitChanges(provider, "/repo", {
      message: "first commit",
      identity,
    });
    const clean = await readGitStatus(provider, "/repo");
    expect(clean.clean).toBe(true);

    const log = await readGitLog(provider, "/repo");
    expect(log).toHaveLength(1);
    expect(log[0].message).toBe("first commit");
    expect(log[0].author).toBe("Tester");
  });

  it("stages a changed file and restores it by discarding", async () => {
    const provider = createMemoryProvider();
    await provider.mkdir("/repo");
    await initGitRepository(provider, "/repo");
    await write(provider, "/repo/a.txt", "one\n");
    await stageGitFiles(provider, "/repo");
    await commitGitChanges(provider, "/repo", { message: "one", identity });

    await write(provider, "/repo/a.txt", "two\n");
    const modified = await readGitStatus(provider, "/repo");
    expect(modified.files[0]).toMatchObject({
      path: "a.txt",
      worktree: "M",
      unstaged: true,
    });

    await stageGitFiles(provider, "/repo", ["a.txt"]);
    expect((await readGitStatus(provider, "/repo")).files[0].staged).toBe(true);
    await unstageGitFiles(provider, "/repo", ["a.txt"]);
    expect((await readGitStatus(provider, "/repo")).files[0].staged).toBe(false);

    await discardGitChanges(provider, "/repo", modified.files);
    expect(await text(provider, "/repo/a.txt")).toBe("one\n");
    expect((await readGitStatus(provider, "/repo")).clean).toBe(true);
  });

  it("creates, switches and deletes branches", async () => {
    const provider = createMemoryProvider();
    await provider.mkdir("/repo");
    await initGitRepository(provider, "/repo");
    await write(provider, "/repo/a.txt", "one\n");
    await stageGitFiles(provider, "/repo");
    await commitGitChanges(provider, "/repo", { message: "one", identity });

    await createGitBranch(provider, "/repo", "feature", { checkout: true });
    let branches = await listGitBranches(provider, "/repo");
    expect(branches.current).toBe("feature");
    expect(branches.local.sort()).toEqual(["feature", "main"]);

    await checkoutGitBranch(provider, "/repo", "main");
    branches = await listGitBranches(provider, "/repo");
    expect(branches.current).toBe("main");

    await deleteGitBranch(provider, "/repo", "feature");
    branches = await listGitBranches(provider, "/repo");
    expect(branches.local).toEqual(["main"]);
  });

  it("refuses to clone into a folder that already has files", async () => {
    const provider = createMemoryProvider();
    await provider.mkdir("/repo");
    await write(provider, "/repo/existing.txt", "x");

    await expect(
      import("../repo").then(({ cloneGitRepository }) =>
        cloneGitRepository(provider, "/repo", {
          url: "https://example.org/team/project.git",
        }),
      ),
    ).rejects.toBeInstanceOf(GitError);
  });

  it("reports a read-only source instead of writing to it", async () => {
    const provider = createMemoryProvider();
    provider.capabilities = {
      ...provider.capabilities,
      write: false,
    } as FileProvider["capabilities"];

    await expect(initGitRepository(provider, "/")).rejects.toMatchObject({
      code: "READ_ONLY_PROVIDER",
    });
  });
});
