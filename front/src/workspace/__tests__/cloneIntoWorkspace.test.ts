import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => {
  const rootProvider = {
    status: "connected",
    capabilities: { write: true, mkdir: true },
    connect: vi.fn(async () => {}),
    stat: vi.fn(),
    close: vi.fn(),
  };
  const sourceProvider = {
    status: "connected",
    capabilities: { write: true, mkdir: true },
    connect: vi.fn(async () => {}),
    stat: vi.fn(),
    close: vi.fn(),
  };
  return {
    rootProvider,
    sourceProvider,
    getWorkspaceSource: vi.fn(),
    addWorkspaceMount: vi.fn(async () => "mount-1"),
    cloneId: vi.fn(() => "clone-1"),
    cloneRepositoryWithAgent: vi.fn(async () => ({
      tempBase: ".chat-ai-clones/clone-1",
      repoDir: ".chat-ai-clones/clone-1/repo",
    })),
    readManifestFromAgent: vi.fn(async () => null),
    measureAgentProject: vi.fn(async () => ({ files: 2, bytes: 12 })),
    copyAgentProjectToProvider: vi.fn(async () => {}),
    cleanupAgentClone: vi.fn(async () => {}),
  };
});

vi.mock("../importProject", () => ({
  cloneId: api.cloneId,
  cloneRepositoryWithAgent: api.cloneRepositoryWithAgent,
  readManifestFromAgent: api.readManifestFromAgent,
  measureAgentProject: api.measureAgentProject,
  copyAgentProjectToProvider: api.copyAgentProjectToProvider,
  cleanupAgentClone: api.cleanupAgentClone,
}));

vi.mock("../../db/workspaceDb", () => ({
  getWorkspaceSource: api.getWorkspaceSource,
  addWorkspaceMount: api.addWorkspaceMount,
}));

vi.mock("../providers", () => ({
  createProvider: () => api.sourceProvider,
}));

vi.mock("../workspaceRoot", () => ({
  createWorkspaceRootProvider: () => api.rootProvider,
}));

import { cloneIntoWorkspace } from "../cloneIntoWorkspace";

const agent = { id: "agent-1", sessionId: "session-1" };
const notFound = async () => {
  const error = new Error("not found");
  error.code = "NOT_FOUND";
  throw error;
};

const input = {
  workspaceId: "ws-1",
  agent,
  url: "https://example.org/team/repo.git",
  branch: "main",
  folder: "repo",
};

describe("cloneIntoWorkspace", () => {
  beforeEach(() => {
    api.rootProvider.stat.mockReset();
    api.rootProvider.stat.mockImplementation(notFound);
    api.sourceProvider.stat.mockReset();
    api.sourceProvider.stat.mockImplementation(notFound);
    api.getWorkspaceSource.mockReset();
    api.getWorkspaceSource.mockResolvedValue({
      id: "source-1",
      workspaceId: "ws-1",
      kind: "local",
      label: "Local",
      readOnly: false,
      capabilities: { write: true },
    });
    api.addWorkspaceMount.mockReset();
    api.addWorkspaceMount.mockResolvedValue("mount-1");
    api.cloneId.mockReset();
    api.cloneId.mockReturnValue("clone-1");
    api.cloneRepositoryWithAgent.mockReset();
    api.cloneRepositoryWithAgent.mockResolvedValue({
      tempBase: ".chat-ai-clones/clone-1",
      repoDir: ".chat-ai-clones/clone-1/repo",
    });
    api.readManifestFromAgent.mockReset();
    api.readManifestFromAgent.mockResolvedValue(null);
    api.measureAgentProject.mockReset();
    api.measureAgentProject.mockResolvedValue({ files: 2, bytes: 12 });
    api.copyAgentProjectToProvider.mockReset();
    api.copyAgentProjectToProvider.mockResolvedValue(undefined);
    api.cleanupAgentClone.mockReset();
    api.cleanupAgentClone.mockResolvedValue(undefined);
  });

  it("copies into the workspace root without mounting for the browser target", async () => {
    const result = await cloneIntoWorkspace(input);

    expect(api.copyAgentProjectToProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: api.rootProvider,
        targetRoot: "/repo",
      }),
    );
    expect(api.addWorkspaceMount).not.toHaveBeenCalled();
    expect(api.cleanupAgentClone).toHaveBeenCalledWith(
      agent,
      ".chat-ai-clones/clone-1",
    );
    expect(result).toEqual({ path: "/repo" });
  });

  it("mounts the copied folder for a writable source target", async () => {
    const result = await cloneIntoWorkspace({
      ...input,
      target: { sourceId: "source-1" },
    });

    expect(api.sourceProvider.stat).toHaveBeenCalledWith("/repo");
    expect(api.copyAgentProjectToProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: api.sourceProvider,
        targetRoot: "/repo",
      }),
    );
    expect(api.addWorkspaceMount).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      sourceId: "source-1",
      sourcePath: "/repo",
      path: "/repo",
    });
    expect(result).toEqual({
      path: "/repo",
      sourceId: "source-1",
      mountId: "mount-1",
    });
  });

  it("cleans up after a failing copy and rethrows its message", async () => {
    api.copyAgentProjectToProvider.mockRejectedValueOnce(new Error("disk full"));

    await expect(cloneIntoWorkspace(input)).rejects.toThrow("disk full");

    expect(api.cleanupAgentClone).toHaveBeenCalledWith(
      agent,
      ".chat-ai-clones/clone-1",
    );
    expect(api.addWorkspaceMount).not.toHaveBeenCalled();
  });

  it("cleans up after a failing clone", async () => {
    api.cloneRepositoryWithAgent.mockRejectedValueOnce(
      new Error("git clone failed"),
    );

    await expect(cloneIntoWorkspace(input)).rejects.toThrow("git clone failed");

    expect(api.cleanupAgentClone).toHaveBeenCalledWith(
      agent,
      ".chat-ai-clones/clone-1",
    );
  });
});
