import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  conversationWorkspaces: vi.fn(),
  workspacesByIds: vi.fn(),
  sources: vi.fn(),
  mounts: vi.fn(),
  agentLinks: vi.fn(),
  sessionIds: vi.fn(),
  getAgents: vi.fn(),
  createProvider: vi.fn(),
  rootProvider: vi.fn(),
}));

vi.mock("../../db/workspaceDb", () => ({
  getConversationWorkspaceIds: (...args) => mocks.conversationWorkspaces(...args),
  listWorkspacesByIds: (...args) => mocks.workspacesByIds(...args),
  listWorkspaceSources: (...args) => mocks.sources(...args),
  listWorkspaceMounts: (...args) => mocks.mounts(...args),
  getWorkspaceAgentLinks: (...args) => mocks.agentLinks(...args),
  getWorkspaceAgentSessionIds: (...args) => mocks.sessionIds(...args),
}));

vi.mock("../../agents/agentStore", () => ({
  getAgents: (...args) => mocks.getAgents(...args),
}));

vi.mock("../../workspace/providers", () => ({
  createProvider: (...args) => mocks.createProvider(...args),
}));

vi.mock("../../workspace/workspaceRoot", () => ({
  createWorkspaceRootProvider: (...args) => mocks.rootProvider(...args),
}));

vi.mock("../../workspace/deviceId", () => ({
  getDeviceId: () => "device-1",
  DEVICE_PLANE_KINDS: new Set(["browser", "local", "mcp"]),
}));

import { createWorkspaceTools } from "../workspaceTools";

const textOf = (result: any) =>
  (result?.content ?? []).map((item: any) => item.text).join("");

const capabilities = {
  read: true,
  write: true,
  append: true,
  delete: true,
  mkdir: true,
  rename: true,
  move: true,
  copy: true,
  serverSideMove: false,
  serverSideCopy: false,
  quota: false,
  watch: false,
  range: false,
};

const workspace = {
  id: "ws-1",
  name: "Team files",
  createdAt: 1,
  lastModified: 1,
};

const browserSource = {
  id: "src-browser",
  workspaceId: "ws-1",
  kind: "browser",
  label: "Browser storage",
  deviceId: "device-1",
  config: { storage: "indexeddb" },
  capabilities,
  status: "connected",
  createdAt: 1,
  lastModified: 1,
};

const arcanaSource = {
  id: "src-arcana",
  workspaceId: "ws-1",
  kind: "arcana",
  label: "Shared documents",
  config: { remoteWorkspaceId: "shared" },
  capabilities,
  status: "connected",
  createdAt: 1,
  lastModified: 1,
};

const mount = {
  id: "mount-1",
  workspaceId: "ws-1",
  sourceId: "src-arcana",
  sourcePath: "/docs",
  path: "/shared",
  createdAt: 1,
  lastModified: 1,
};

const agent = {
  id: "agent-1",
  name: "HPC agent",
  sessionId: "session-1",
};

const otherAgent = { id: "agent-2", name: "Helper" };

const providerWith = (overrides: Record<string, any> = {}) => ({
  sourceId: "src",
  kind: "browser",
  capabilities,
  status: "connected",
  connect: vi.fn(async () => {}),
  close: vi.fn(),
  list: vi.fn(async () => ({ entries: [] })),
  stat: vi.fn(),
  read: vi.fn(),
  write: vi.fn(async () => ({})),
  append: vi.fn(async () => {}),
  rename: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
  remove: vi.fn(),
  ...overrides,
});

const bytesOf = (value: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });

const vfs = () => ({
  mkdir: vi.fn(async () => {}),
  writeFile: vi.fn(async () => {}),
  appendFile: vi.fn(async () => {}),
  rename: vi.fn(async (path: string, newName: string) =>
    `${path.slice(0, path.lastIndexOf("/"))}/${newName}`,
  ),
});

const tool = async (
  name: string,
  workspaceVfs = vfs(),
  primaryWorkspaceId?: string,
) => {
  const { tools, context } = await createWorkspaceTools(
    "chat-1",
    workspaceVfs as any,
    primaryWorkspaceId,
  );
  const found = tools.find((item) => item.name === name);
  if (!found) throw new Error(`missing tool ${name}`);
  return { run: (args: any) => found.execute("call", args), context, workspaceVfs };
};

beforeEach(() => {
  mocks.conversationWorkspaces.mockReset().mockResolvedValue(["ws-1"]);
  mocks.workspacesByIds.mockReset().mockResolvedValue([workspace]);
  mocks.sources.mockReset().mockResolvedValue([browserSource, arcanaSource]);
  mocks.mounts.mockReset().mockResolvedValue([mount]);
  mocks.agentLinks
    .mockReset()
    .mockResolvedValue([{ id: "link-1", workspaceId: "ws-1", agentId: "agent-1" }]);
  mocks.sessionIds.mockReset().mockResolvedValue(["session-1", "session-2"]);
  mocks.getAgents.mockReset().mockReturnValue([agent, otherAgent]);
  mocks.createProvider.mockReset();
  mocks.rootProvider.mockReset();
});

describe("createWorkspaceTools", () => {
  it("offers no workspace tools without a workspace link", async () => {
    mocks.conversationWorkspaces.mockResolvedValue([]);

    const { tools, context } = await createWorkspaceTools("chat-1", {} as any);

    expect(tools).toHaveLength(0);
    expect(context.workspaceIds).toEqual([]);
  });

  it("omits the workspace write tool when writing is switched off", async () => {
    const { tools } = await createWorkspaceTools(
      "chat-1",
      vfs() as any,
      undefined,
      { writable: false },
    );

    const names = tools.map((item) => item.name);
    expect(names).not.toContain("workspace_write_file");
    expect(names).not.toContain("workspace_append_file");
    expect(names).not.toContain("workspace_rename");
    expect(names).toContain("workspace_read_file");
  });

  it("lists workspaces with their sources, mounts and agents", async () => {
    const list = await tool("workspace_list");

    const output = textOf(await list.run({}));

    expect(output).toContain("Workspace: Team files (ws-1)");
    expect(output).toContain("Browser storage (browser, id: src-browser)");
    expect(output).toContain("/shared → Shared documents:/docs");
    expect(output).toContain("- HPC agent (agent-1)");
    expect(output).toContain("1 other configured agent(s)");
    expect(list.context.workspaces[0]).toMatchObject({
      id: "ws-1",
      sourceCount: 2,
      mountCount: 1,
      agentIds: ["agent-1"],
    });
  });

  it("lists attached agents and marks the others as inaccessible", async () => {
    const list = await tool("workspace_list_agents");

    const output = textOf(await list.run({}));

    expect(output).toContain("Attached agents:");
    expect(output).toContain("HPC agent (agent-1)");
    expect(output).toContain("2 session(s) attached");
    expect(output).toContain(
      "Other configured agents (not attached; not accessible from this chat): Helper (agent-2)",
    );
  });

  it("says so when no agent is attached", async () => {
    mocks.getAgents.mockReturnValue([otherAgent]);
    mocks.agentLinks.mockResolvedValue([]);

    const list = await tool("workspace_list_agents");

    expect(textOf(await list.run({}))).toContain("Attached agents: none");
  });

  it("lists the workspace root together with its mounted folders", async () => {
    const root = providerWith({
      list: vi.fn(async () => ({
        entries: [
          {
            sourceId: "workspace-root:ws-1",
            path: "/notes.md",
            name: "notes.md",
            kind: "file",
            size: 12,
          },
        ],
      })),
    });
    mocks.rootProvider.mockReturnValue(root);

    const files = await tool("workspace_files");
    const output = textOf(await files.run({ path: "/" }));

    expect(mocks.rootProvider).toHaveBeenCalledWith("ws-1");
    expect(output).toContain("file /notes.md (12 bytes)");
    expect(output).toContain("dir  /shared  (mounted folder)");
    expect(root.close).toHaveBeenCalled();
  });

  it("lists a source that is not mounted", async () => {
    const provider = providerWith({
      list: vi.fn(async () => ({
        entries: [
          {
            sourceId: "src-arcana",
            path: "/docs/intro.txt",
            name: "intro.txt",
            kind: "file",
            size: 3,
          },
        ],
      })),
    });
    mocks.createProvider.mockReturnValue(provider);

    const files = await tool("workspace_files");
    const output = textOf(
      await files.run({ source: "Shared documents", path: "/" }),
    );

    expect(mocks.createProvider).toHaveBeenCalledWith(arcanaSource);
    expect(provider.list).toHaveBeenCalledWith("/");
    expect(output).toContain("file intro.txt (3 bytes)");
  });

  it("routes a path inside a mount to its source", async () => {
    const provider = providerWith({
      list: vi.fn(async () => ({ entries: [] })),
    });
    mocks.createProvider.mockReturnValue(provider);

    const files = await tool("workspace_files");
    await files.run({ path: "/shared/sub" });

    expect(provider.list).toHaveBeenCalledWith("/docs/sub");
  });

  it("reads a file through a provider", async () => {
    const provider = providerWith({
      read: vi.fn(async () => bytesOf("hello")),
    });
    mocks.createProvider.mockReturnValue(provider);

    const read = await tool("workspace_read_file");
    const output = textOf(
      await read.run({ source: "Shared documents", path: "/intro.txt" }),
    );

    expect(provider.read).toHaveBeenCalledWith("/intro.txt");
    expect(output).toBe("hello");
  });

  it("maps a workspace path onto the mounted source when the source is named", async () => {
    const provider = providerWith({
      read: vi.fn(async () => bytesOf("hello")),
    });
    mocks.createProvider.mockReturnValue(provider);

    const read = await tool("workspace_read_file");
    await read.run({ source: "Shared documents", path: "/shared/intro.txt" });

    expect(provider.read).toHaveBeenCalledWith("/docs/intro.txt");
  });

  it("maps a path inside an explicit mount from the normalised path", async () => {
    const provider = providerWith({
      read: vi.fn(async () => bytesOf("hello")),
    });
    mocks.createProvider.mockReturnValue(provider);

    const read = await tool("workspace_read_file");
    await read.run({ source: "/shared", path: "/shared/intro.txt" });

    expect(provider.read).toHaveBeenCalledWith("/docs/intro.txt");
  });

  it("keeps an explicit mount path that escapes the mount inside its source path", async () => {
    const provider = providerWith({
      read: vi.fn(async () => bytesOf("hello")),
    });
    mocks.createProvider.mockReturnValue(provider);

    const read = await tool("workspace_read_file");
    await read.run({ source: "/shared", path: "/shared/../../secret" });

    expect(provider.read).toHaveBeenCalledWith("/docs/secret");
  });

  it("writes a file through a provider", async () => {
    const provider = providerWith();
    mocks.createProvider.mockReturnValue(provider);

    const write = await tool("workspace_write_file");
    const output = textOf(
      await write.run({
        source: "Shared documents",
        path: "/docs/new.md",
        content: "hi",
      }),
    );

    expect(provider.write).toHaveBeenCalledWith(
      "/docs/new.md",
      expect.any(ReadableStream),
      { overwrite: true },
    );
    expect(output).toContain("Wrote /docs/new.md");
  });

  it("writes a root file through the chat VFS when it is the primary workspace", async () => {
    const workspaceVfs = vfs();

    const write = await tool("workspace_write_file", workspaceVfs, "ws-1");
    const output = textOf(
      await write.run({ path: "/notes.md", content: "hello" }),
    );

    expect(workspaceVfs.writeFile).toHaveBeenCalledWith(
      "/notes.md",
      "hello",
    );
    expect(output).toContain("Wrote /notes.md");
  });

  it("routes a named source through the deepest matching mount, including read-only", async () => {
    mocks.mounts.mockResolvedValue([
      { ...mount, id: "mount-writable", path: "/x" },
      { ...mount, id: "mount-readonly", path: "/x/ro", readOnly: true },
    ]);
    const provider = providerWith();
    mocks.createProvider.mockReturnValue(provider);

    const write = await tool("workspace_write_file");
    const output = textOf(
      await write.run({
        source: "Shared documents",
        path: "/x/ro/file.md",
        content: "hi",
      }),
    );

    expect(provider.write).not.toHaveBeenCalled();
    expect(output).toContain("That mount is read-only.");
  });

  it("rejects a write through a read-only mount", async () => {
    mocks.mounts.mockResolvedValue([
      mount,
      { ...mount, id: "mount-ro", path: "/readonly", readOnly: true },
    ]);
    const provider = providerWith();
    mocks.createProvider.mockReturnValue(provider);

    const write = await tool("workspace_write_file");
    const output = textOf(
      await write.run({ path: "/readonly/new.md", content: "hi" }),
    );

    expect(provider.write).not.toHaveBeenCalled();
    expect(output).toContain("That mount is read-only.");
  });

  it("appends to a file through a provider", async () => {
    const provider = providerWith();
    mocks.createProvider.mockReturnValue(provider);

    const append = await tool("workspace_append_file");
    const output = textOf(
      await append.run({
        source: "Shared documents",
        path: "/docs/log.md",
        content: "more",
      }),
    );

    expect(provider.append).toHaveBeenCalledWith("/docs/log.md", "more");
    expect(output).toContain("Appended to /docs/log.md");
  });

  it("renames through a provider", async () => {
    const provider = providerWith();
    mocks.createProvider.mockReturnValue(provider);

    const rename = await tool("workspace_rename");
    const output = textOf(
      await rename.run({
        source: "Shared documents",
        path: "/docs/old.md",
        new_name: "new.md",
      }),
    );

    expect(provider.rename).toHaveBeenCalledWith("/docs/old.md", "new.md");
    expect(output).toContain("Renamed /docs/old.md to /docs/new.md");
  });

  it("refuses to rename a mount point", async () => {
    const provider = providerWith();
    mocks.createProvider.mockReturnValue(provider);

    const rename = await tool("workspace_rename");
    const output = textOf(
      await rename.run({ path: "/shared", new_name: "elsewhere" }),
    );

    expect(output).toContain("Cannot rename the mount point /shared");
    expect(provider.rename).not.toHaveBeenCalled();
  });

  it("rejects an append or rename through a read-only mount", async () => {
    mocks.mounts.mockResolvedValue([{ ...mount, readOnly: true }]);
    const provider = providerWith();
    mocks.createProvider.mockReturnValue(provider);

    const append = await tool("workspace_append_file");
    expect(
      textOf(await append.run({ path: "/shared/note.md", content: "hi" })),
    ).toContain("That mount is read-only.");

    const rename = await tool("workspace_rename");
    expect(
      textOf(await rename.run({ path: "/shared/note.md", new_name: "n.md" })),
    ).toContain("That mount is read-only.");

    expect(provider.append).not.toHaveBeenCalled();
    expect(provider.rename).not.toHaveBeenCalled();
  });

  it("appends and renames through the chat VFS when it is the primary workspace", async () => {
    const workspaceVfs = vfs();

    const append = await tool("workspace_append_file", workspaceVfs, "ws-1");
    await append.run({ path: "/notes.md", content: "more" });
    expect(workspaceVfs.appendFile).toHaveBeenCalledWith("/notes.md", "more");

    const rename = await tool("workspace_rename", workspaceVfs, "ws-1");
    const output = textOf(
      await rename.run({ path: "/notes.md", new_name: "final.md" }),
    );
    expect(workspaceVfs.rename).toHaveBeenCalledWith("/notes.md", "final.md");
    expect(output).toContain("Renamed /notes.md to /final.md");
  });

  it("fetches a file into the chat workspace", async () => {
    const provider = providerWith({
      read: vi.fn(
        async () =>
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array([1, 2, 3]));
              controller.close();
            },
          }),
      ),
    });
    mocks.createProvider.mockReturnValue(provider);
    const workspaceVfs = vfs();

    const fetch = await tool("workspace_fetch_file", workspaceVfs);
    const output = textOf(
      await fetch.run({ source: "Shared documents", path: "/docs/logo.png" }),
    );

    expect(workspaceVfs.mkdir).toHaveBeenCalledWith(
      "/workspace-files/Team-files",
    );
    expect(workspaceVfs.writeFile).toHaveBeenCalledWith(
      "/workspace-files/Team-files/logo.png",
      expect.any(Uint8Array),
    );
    expect(output).toContain("Attached /workspace-files/Team-files/logo.png");
  });
});

describe("workspace file access", () => {
  const open = async (workspaceVfs = vfs(), primaryWorkspaceId?: string) =>
    createWorkspaceTools(
      "chat-1",
      workspaceVfs as any,
      primaryWorkspaceId,
    );

  it("is disabled and refuses a source when no workspace is attached", async () => {
    mocks.conversationWorkspaces.mockResolvedValue([]);

    const { files } = await open();

    expect(files.enabled).toBe(false);
    expect(files.describe()).toContain("not attached to a workspace");
    await expect(files.read("Shared documents", "/a.txt")).rejects.toThrow(
      /No workspace is attached to this chat/,
    );
    await expect(
      files.write("Shared documents", "/a.txt", "hi"),
    ).rejects.toThrow(/No workspace is attached to this chat/);
  });

  it("reads through a source named by label, resolving a mount-relative path", async () => {
    const provider = providerWith({
      read: vi.fn(async () => bytesOf("hello")),
    });
    mocks.createProvider.mockReturnValue(provider);

    const { files } = await open();
    const bytes = await files.read("Shared documents", "/shared/intro.txt");

    expect(mocks.createProvider).toHaveBeenCalledWith(arcanaSource);
    expect(provider.read).toHaveBeenCalledWith("/docs/intro.txt");
    expect(new TextDecoder().decode(bytes)).toBe("hello");
  });

  it("writes into the source, creating the parent folder", async () => {
    const provider = providerWith();
    mocks.createProvider.mockReturnValue(provider);

    const { files } = await open();
    await files.write("Shared documents", "/shared/out/note.md", "hi");

    expect(provider.mkdir).toHaveBeenCalledWith("/docs/out");
    expect(provider.write).toHaveBeenCalledWith(
      "/docs/out/note.md",
      expect.anything(),
      { overwrite: true },
    );
  });

  it("refuses a write through a read-only mount", async () => {
    mocks.mounts.mockResolvedValue([{ ...mount, readOnly: true }]);
    const provider = providerWith();
    mocks.createProvider.mockReturnValue(provider);

    const { files } = await open();

    await expect(
      files.write("Shared documents", "/shared/note.md", "hi"),
    ).rejects.toThrow(/read-only/);
    expect(provider.write).not.toHaveBeenCalled();
  });

  it("names the available sources when the reference is unknown", async () => {
    const { files } = await open();

    await expect(files.read("Nowhere", "/a.txt")).rejects.toThrow(
      /Source "Nowhere" not found\. Available sources: Browser storage \(src-browser\), Shared documents \(src-arcana\)\./,
    );
    expect(files.describe()).toBe(
      "Team files: Browser storage (src-browser), Shared documents (src-arcana)",
    );
  });
});
