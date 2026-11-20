import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  read: vi.fn(),
  shell: vi.fn(),
}));

vi.mock("../../apis/opencodeAgents", () => ({
  listOpencodeFiles: (...args) => api.list(...args),
  readOpencodeFile: (...args) => api.read(...args),
  runOpencodeShellAndWait: (...args) => api.shell(...args),
}));

import {
  copyAgentProjectToProvider,
  measureAgentProject,
  parsePublicGitUrl,
} from "../importProject";

const agent = { id: "agent-1", sessionId: "session-1" };
const repoDir = ".chat-ai-clones/1/repo";

// listOpencodeFiles receives the repository path without a leading slash.
const tree = {
  [repoDir]: [
    { path: `/${repoDir}/README.md`, name: "README.md", type: "file", size: 10 },
    { path: `/${repoDir}/src`, name: "src", type: "directory", size: 0 },
  ],
  [`${repoDir}/src`]: [
    { path: `/${repoDir}/src/a.js`, name: "a.js", type: "file", size: 5 },
  ],
};

const fakeProvider = () => {
  const written = [];
  const folders = [];
  return {
    written,
    folders,
    status: "connected",
    capabilities: { write: true, mkdir: true },
    connect: vi.fn(async () => {}),
    mkdir: vi.fn(async (path) => folders.push(path)),
    write: vi.fn(async (path) => written.push(path)),
  };
};

beforeEach(() => {
  api.list.mockReset();
  api.read.mockReset();
  api.shell.mockReset();
  api.list.mockImplementation(async (_agent, path) => tree[path] || []);
  // jsdom's Blob has no stream(); the provider only forwards it.
  api.read.mockResolvedValue({
    blob: { size: 1, stream: () => null },
    type: "",
  });
});

describe("parsePublicGitUrl", () => {
  it("accepts a public HTTPS repository URL", () => {
    expect(parsePublicGitUrl("  https://example.org/team/repo.git ")).toBe(
      "https://example.org/team/repo.git",
    );
  });

  it("rejects a missing or malformed URL", () => {
    expect(() => parsePublicGitUrl("")).toThrow(/required/i);
    expect(() => parsePublicGitUrl("not a url")).toThrow(/invalid/i);
  });

  it("rejects non-HTTPS and credentialed URLs", () => {
    expect(() => parsePublicGitUrl("http://example.org/repo.git")).toThrow(
      /HTTPS/i,
    );
    expect(() => parsePublicGitUrl("ssh://git@example.org/repo.git")).toThrow(
      /HTTPS/i,
    );
    expect(() =>
      parsePublicGitUrl("https://user:token@example.org/repo.git"),
    ).toThrow(/Credentials/i);
  });
});

describe("measureAgentProject", () => {
  it("walks nested folders and adds up files and bytes", async () => {
    const result = await measureAgentProject(agent, repoDir);

    expect(api.list).toHaveBeenCalledWith(agent, repoDir);
    expect(api.list).toHaveBeenCalledWith(agent, `${repoDir}/src`);
    expect(result).toEqual({ files: 2, bytes: 15 });
  });
});

describe("copyAgentProjectToProvider", () => {
  it("creates folders and writes every file below the target root", async () => {
    const provider = fakeProvider();

    await copyAgentProjectToProvider({
      agent,
      repoDir,
      provider,
      targetRoot: "/imported",
    });

    expect(provider.folders).toContain("/imported");
    expect(provider.folders).toContain("/imported/src");
    expect(provider.written).toEqual([
      "/imported/README.md",
      "/imported/src/a.js",
    ]);
  });

  it("connects a provider that is not connected yet", async () => {
    const provider = fakeProvider();
    provider.status = "idle";

    await copyAgentProjectToProvider({
      agent,
      repoDir,
      provider,
      targetRoot: "/imported",
    });

    expect(provider.connect).toHaveBeenCalled();
  });

  it("reports progress for every fortieth file", async () => {
    const files = Array.from({ length: 41 }, (_, index) => ({
      path: `/${repoDir}/file-${index}.txt`,
      name: `file-${index}.txt`,
      type: "file",
      size: 1,
    }));
    api.list.mockImplementation(async (_agent, path) =>
      path === repoDir ? files : [],
    );
    const provider = fakeProvider();
    const onProgress = vi.fn();

    await copyAgentProjectToProvider({
      agent,
      repoDir,
      provider,
      targetRoot: "/imported",
      onProgress,
    });

    expect(provider.written).toHaveLength(41);
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({ files: 40, bytes: 40 });
  });
});
