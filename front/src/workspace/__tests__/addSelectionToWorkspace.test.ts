import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => {
  const rootProvider = {
    sourceId: "workspace-root:ws-1",
    status: "connected",
    connect: vi.fn(async () => {}),
    list: vi.fn(async () => ({ entries: [] })),
  };
  const sourceProvider = {
    sourceId: "source-1",
    status: "connected",
    connect: vi.fn(async () => {}),
  };
  return {
    rootProvider,
    sourceProvider,
    listWorkspaceSources: vi.fn(),
    listWorkspaceMounts: vi.fn(),
    addWorkspaceMount: vi.fn(),
    attachWorkspaceChat: vi.fn(),
    runTransfer: vi.fn(),
    createProvider: vi.fn(),
    createWorkspaceRootProvider: vi.fn(),
    chatStorageDir: vi.fn(),
  };
});

vi.mock("../../db/workspaceDb", () => ({
  listWorkspaceSources: api.listWorkspaceSources,
  listWorkspaceMounts: api.listWorkspaceMounts,
  addWorkspaceMount: api.addWorkspaceMount,
  attachWorkspaceChat: api.attachWorkspaceChat,
}));

vi.mock("../providers", () => ({
  createProvider: api.createProvider,
}));

vi.mock("../transfer", () => ({
  runTransfer: api.runTransfer,
}));

vi.mock("../workspaceRoot", () => ({
  createWorkspaceRootProvider: api.createWorkspaceRootProvider,
}));

vi.mock("../chatStorage", () => ({
  chatStorageDir: api.chatStorageDir,
}));

import {
  addSelectionToWorkspace,
  type WorkspaceSelection,
} from "../addSelectionToWorkspace";

const source = {
  id: "source-1",
  workspaceId: "ws-1",
  kind: "local",
  label: "Local",
  config: { handleKey: "handle-1" },
  capabilities: {},
  status: "connected",
  createdAt: 1,
  lastModified: 1,
};

const folder = (overrides: Partial<WorkspaceSelection> = {}): WorkspaceSelection => ({
  sourceId: "source-1",
  sourceKind: "local",
  path: "/Docs",
  name: "Docs",
  kind: "dir",
  ...overrides,
});

const file = (overrides: Partial<WorkspaceSelection> = {}): WorkspaceSelection => ({
  sourceId: "source-1",
  sourceKind: "local",
  path: "/Docs/a.txt",
  name: "a.txt",
  kind: "file",
  ...overrides,
});

beforeEach(() => {
  for (const mock of [
    api.listWorkspaceSources,
    api.listWorkspaceMounts,
    api.addWorkspaceMount,
    api.attachWorkspaceChat,
    api.runTransfer,
    api.createProvider,
    api.createWorkspaceRootProvider,
    api.chatStorageDir,
  ]) {
    mock.mockReset();
  }
  api.rootProvider.list.mockReset();
  api.rootProvider.connect.mockReset();
  api.sourceProvider.connect.mockReset();
  api.listWorkspaceSources.mockResolvedValue([source]);
  api.listWorkspaceMounts.mockResolvedValue([]);
  api.addWorkspaceMount.mockResolvedValue("mount-1");
  api.attachWorkspaceChat.mockResolvedValue(undefined);
  api.runTransfer.mockResolvedValue(undefined);
  api.createProvider.mockReturnValue(api.sourceProvider);
  api.createWorkspaceRootProvider.mockReturnValue(api.rootProvider);
  api.rootProvider.list.mockResolvedValue({ entries: [] });
  api.sourceProvider.status = "connected";
  api.rootProvider.status = "connected";
});

describe("addSelectionToWorkspace mounting folders", () => {
  it("mounts a local folder under its sanitised display name", async () => {
    const result = await addSelectionToWorkspace("ws-1", [
      folder({ path: "/Docs/My Project", name: "My Project", title: "My / Project" }),
    ]);

    expect(api.addWorkspaceMount).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      sourceId: "source-1",
      sourcePath: "/Docs/My Project",
      path: "/My Project",
      readOnly: false,
    });
    expect(api.runTransfer).not.toHaveBeenCalled();
    expect(result).toEqual({ mounted: 1, copied: 0, failed: [] });
  });

  it("mounts an MCP folder without copying it", async () => {
    const result = await addSelectionToWorkspace("ws-1", [
      folder({ sourceKind: "mcp", path: "/docs", name: "docs" }),
    ]);

    expect(api.addWorkspaceMount).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      sourceId: "source-1",
      sourcePath: "/docs",
      path: "/docs",
      readOnly: false,
    });
    expect(api.runTransfer).not.toHaveBeenCalled();
    expect(result).toEqual({ mounted: 1, copied: 0, failed: [] });
  });

  it("mounts a saia-rag collection live and keeps its reader role", async () => {
    const result = await addSelectionToWorkspace("ws-1", [
      {
        sourceId: "source-1",
        sourceKind: "saia-rag",
        path: "/bob__papers",
        name: "bob__papers",
        kind: "dir",
        readOnly: true,
      },
    ]);

    expect(api.addWorkspaceMount).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "source-1",
        sourcePath: "/bob__papers",
        readOnly: true,
      }),
    );
    expect(api.runTransfer).not.toHaveBeenCalled();
    expect(result).toEqual({ mounted: 1, copied: 0, failed: [] });
  });

  it("refuses to mount the whole saia-rag collection list", async () => {
    const result = await addSelectionToWorkspace("ws-1", [
      {
        sourceId: "source-1",
        sourceKind: "saia-rag",
        path: "/",
        name: "SAIA RAG",
        kind: "dir",
      },
    ]);

    expect(api.addWorkspaceMount).not.toHaveBeenCalled();
    expect(result.mounted).toBe(0);
    expect(result.failed).toHaveLength(1);
  });

  it("suffixes a second folder with the same name", async () => {
    const result = await addSelectionToWorkspace("ws-1", [
      folder({ path: "/A/Docs" }),
      folder({ path: "/B/Docs" }),
    ]);

    expect(api.addWorkspaceMount.mock.calls.map((call) => call[0].path)).toEqual([
      "/Docs",
      "/Docs (2)",
    ]);
    expect(result).toEqual({ mounted: 2, copied: 0, failed: [] });
  });

  it("treats an existing root node with the same name as taken", async () => {
    api.rootProvider.list.mockResolvedValue({
      entries: [{ name: "Docs", path: "/Docs", kind: "dir" }],
    });

    await addSelectionToWorkspace("ws-1", [folder()]);

    expect(api.addWorkspaceMount).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/Docs (2)" }),
    );
  });
});

describe("addSelectionToWorkspace copying files", () => {
  it("copies a file into the workspace root", async () => {
    const result = await addSelectionToWorkspace("ws-1", [file()]);

    expect(api.createProvider).toHaveBeenCalledWith(source);
    expect(api.runTransfer).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      from: api.sourceProvider,
      to: api.rootProvider,
      entry: {
        sourceId: "source-1",
        path: "/Docs/a.txt",
        name: "a.txt",
        kind: "file",
      },
      targetDir: "/",
      strategy: "copy",
    });
    expect(result).toEqual({ mounted: 0, copied: 1, failed: [] });
  });

  it("links a chat root without copying it", async () => {
    const chat = {
      sourceId: "chat-1",
      sourceKind: "chat" as const,
      path: "/",
      name: "chat-1",
      kind: "dir" as const,
      conversationId: "chat-1",
      title: "Trip planning",
    };

    const first = await addSelectionToWorkspace("ws-1", [chat]);
    const second = await addSelectionToWorkspace("ws-1", [chat]);

    expect(api.attachWorkspaceChat).toHaveBeenCalledTimes(2);
    expect(api.attachWorkspaceChat).toHaveBeenNthCalledWith(1, "ws-1", "chat-1");
    expect(api.attachWorkspaceChat).toHaveBeenNthCalledWith(2, "ws-1", "chat-1");
    expect(api.runTransfer).not.toHaveBeenCalled();
    expect(api.addWorkspaceMount).not.toHaveBeenCalled();
    expect(first).toEqual({ mounted: 1, copied: 0, failed: [] });
    expect(second).toEqual({ mounted: 1, copied: 0, failed: [] });
  });
});

describe("addSelectionToWorkspace failures and progress", () => {
  it("reports a failed item and keeps processing the rest", async () => {
    api.runTransfer.mockRejectedValueOnce(new Error("disk full"));

    const result = await addSelectionToWorkspace("ws-1", [
      file({ name: "broken.txt", path: "/broken.txt" }),
      folder({ path: "/B/Docs" }),
    ]);

    expect(result).toEqual({
      mounted: 1,
      copied: 0,
      failed: [{ name: "broken.txt", error: "disk full" }],
    });
    expect(api.addWorkspaceMount).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePath: "/B/Docs", path: "/Docs" }),
    );
  });

  it("reports progress after every item", async () => {
    const onProgress = vi.fn();

    await addSelectionToWorkspace(
      "ws-1",
      [folder({ path: "/A/Docs" }), folder({ path: "/B/Docs" }), file()],
      { onProgress },
    );

    expect(onProgress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });
});
