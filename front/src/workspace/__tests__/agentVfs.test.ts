import { describe, expect, it } from "vitest";

import type { WorkspaceMountRow } from "../../db/dbTypes";
import type { Vfs } from "../../agent/vfs";
import { WorkspaceAgentVfs } from "../agentVfs";
import { defaultCapabilities } from "../capabilities";
import type { BrowserProvider } from "../providers/browser";
import type { FileProvider } from "../providers/types";

const emptyConversation: Vfs = {
  readFile: async () => new Uint8Array(),
  writeFile: async () => {},
  mkdir: async () => {},
  readdir: async () => [],
  stat: async () => null,
  remove: async () => {},
};

const streamText = async (stream: ReadableStream<Uint8Array>) => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return new TextDecoder().decode(
    new Uint8Array(chunks.flatMap((chunk) => [...chunk])),
  );
};

const makeRoot = () => {
  const calls = {
    list: [] as string[],
    write: [] as string[],
    mkdir: [] as string[],
    remove: [] as string[],
    append: [] as string[],
    rename: [] as [string, string][],
  };
  const root = {
    sourceId: "root",
    kind: "browser",
    capabilities: defaultCapabilities("browser"),
    status: "connected",
    connect: async () => {},
    list: async (path: string) => {
      calls.list.push(path);
      return {
        entries: [
          {
            sourceId: "root",
            path: "/root.txt",
            name: "root.txt",
            kind: "file" as const,
          },
        ],
      };
    },
    stat: async (path: string) => ({
      sourceId: "root",
      path,
      name: path,
      kind: "file" as const,
    }),
    read: async () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      }),
    write: async (path: string) => {
      calls.write.push(path);
      return {
        sourceId: "root",
        path,
        name: path,
        kind: "file" as const,
      };
    },
    mkdir: async (path: string) => {
      calls.mkdir.push(path);
    },
    remove: async (path: string) => {
      calls.remove.push(path);
    },
    append: async (path: string) => {
      calls.append.push(path);
    },
    rename: async (path: string, newName: string) => {
      calls.rename.push([path, newName]);
    },
  };
  return { root: root as unknown as BrowserProvider, calls };
};

const makeMountProvider = (write = true) => {
  const calls = {
    list: [] as string[],
    write: [] as string[],
    mkdir: [] as string[],
    remove: [] as string[],
    append: [] as string[],
    rename: [] as [string, string][],
  };
  let written = "";
  const provider = {
    sourceId: "source",
    kind: "local",
    capabilities: { ...defaultCapabilities("local"), write },
    status: "connected",
    connect: async () => {},
    list: async (path: string) => {
      calls.list.push(path);
      return { entries: [] };
    },
    stat: async (path: string) => ({
      sourceId: "source",
      path,
      name: path,
      kind: "file" as const,
    }),
    read: async () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      }),
    write: async (path: string, stream: ReadableStream<Uint8Array>) => {
      calls.write.push(path);
      written = await streamText(stream);
      return {
        sourceId: "source",
        path,
        name: path,
        kind: "file" as const,
      };
    },
    mkdir: async (path: string) => {
      calls.mkdir.push(path);
    },
    remove: async (path: string) => {
      calls.remove.push(path);
    },
    append: async (path: string) => {
      calls.append.push(path);
    },
    rename: async (path: string, newName: string) => {
      calls.rename.push([path, newName]);
    },
  };
  return {
    provider: provider as unknown as FileProvider,
    calls,
    get written() {
      return written;
    },
  };
};

const mount = (readOnly: boolean): WorkspaceMountRow => ({
  id: "mount-1",
  workspaceId: "workspace-1",
  sourceId: "source",
  sourcePath: "/",
  path: "/mnt",
  readOnly,
  createdAt: 0,
  lastModified: 0,
});

const mountAt = (
  path: string,
  readOnly = false,
  sourcePath = "/",
): WorkspaceMountRow => ({
  ...mount(readOnly),
  id: `mount-${path}`,
  path,
  sourcePath,
});

describe("WorkspaceAgentVfs", () => {
  it("refuses writeFile, mkdir, and remove on a read-only mount", async () => {
    const { root } = makeRoot();
    const mounted = makeMountProvider();
    const vfs = new WorkspaceAgentVfs(
      emptyConversation,
      "workspace-1",
      root,
      [{ mount: mount(true), provider: mounted.provider }],
    );

    await expect(vfs.writeFile("/mnt/a.txt", "hello")).rejects.toThrow(
      "That mount is read-only.",
    );
    await expect(vfs.mkdir("/mnt/new")).rejects.toThrow(
      "That mount is read-only.",
    );
    await expect(vfs.remove("/mnt/a.txt")).rejects.toThrow(
      "That mount is read-only.",
    );
    expect(mounted.calls).toMatchObject({
      list: [],
      write: [],
      mkdir: [],
      remove: [],
      append: [],
      rename: [],
    });
  });

  it("refuses a routed write when the provider capabilities are read-only", async () => {
    const { root } = makeRoot();
    const mounted = makeMountProvider(false);
    const vfs = new WorkspaceAgentVfs(
      emptyConversation,
      "workspace-1",
      root,
      [{ mount: mount(false), provider: mounted.provider }],
    );

    await expect(vfs.writeFile("/mnt/a.txt", "hello")).rejects.toThrow(
      "That mount is read-only.",
    );
    expect(mounted.calls.write).toEqual([]);
  });

  it("writes through a writable mount", async () => {
    const { root } = makeRoot();
    const mounted = makeMountProvider();
    const vfs = new WorkspaceAgentVfs(
      emptyConversation,
      "workspace-1",
      root,
      [{ mount: mount(false), provider: mounted.provider }],
    );

    await vfs.writeFile("/mnt/a.txt", "hello");

    expect(mounted.calls.write).toEqual(["/a.txt"]);
    expect(mounted.written).toBe("hello");
  });

  it("routes an overlapping path to the longest mount prefix", async () => {
    const { root } = makeRoot();
    const chats = makeMountProvider();
    const chat = makeMountProvider();
    const vfs = new WorkspaceAgentVfs(emptyConversation, "workspace-1", root, [
      { mount: mountAt("/chats"), provider: chats.provider },
      { mount: mountAt("/chats/chat-1"), provider: chat.provider },
    ]);

    await vfs.writeFile("/chats/chat-1/f", "hello");

    expect(chats.calls.write).toEqual([]);
    expect(chat.calls.write).toEqual(["/f"]);
  });

  it("keeps the uploads namespace ahead of a read-only mount there", async () => {
    const { root } = makeRoot();
    const mounted = makeMountProvider();
    const uploads: string[] = [];
    const conversation: Vfs = {
      ...emptyConversation,
      writeFile: async (path) => {
        uploads.push(path);
      },
    };
    const vfs = new WorkspaceAgentVfs(conversation, "workspace-1", root, [
      { mount: mountAt("/uploads", true), provider: mounted.provider },
    ]);

    await vfs.writeFile("/uploads/file.txt", "hello");

    expect(uploads).toEqual(["/uploads/file.txt"]);
    expect(mounted.calls.write).toEqual([]);
    expect(vfs.mountLabels()).toEqual([]);
  });

  it("normalises before routing, so dotdot cannot select a different mount", async () => {
    const { root, calls: rootCalls } = makeRoot();
    const mounted = makeMountProvider();
    const vfs = new WorkspaceAgentVfs(
      emptyConversation,
      "workspace-1",
      root,
      [{ mount: mount(true), provider: mounted.provider }],
    );

    await vfs.writeFile("/mnt/../etc/x", "hello");

    expect(rootCalls.write).toEqual(["/etc/x"]);
    expect(mounted.calls.write).toEqual([]);
  });

  it("still lists virtual mounts", async () => {
    const { root, calls } = makeRoot();
    const mounted = makeMountProvider();
    const vfs = new WorkspaceAgentVfs(
      emptyConversation,
      "workspace-1",
      root,
      [{ mount: mount(false), provider: mounted.provider }],
    );

    const entries = await vfs.readdir("/");

    expect(calls.list).toEqual(["/"]);
    expect(entries).toEqual([
      { name: "mnt", dir: true },
      { name: "root.txt", dir: false },
    ]);
  });

  // The sidebar keeps its own copy of every folder it has listed, so a write the
  // agent makes has to be announced or the row never appears.
  it("announces every write, mkdir and remove for its workspace", async () => {
    const { root } = makeRoot();
    const mounted = makeMountProvider();
    const vfs = new WorkspaceAgentVfs(
      emptyConversation,
      "workspace-1",
      root,
      [{ mount: mount(false), provider: mounted.provider }],
    );
    const seen: string[] = [];
    const listen = (event: Event) => {
      seen.push((event as CustomEvent).detail?.workspaceId ?? "none");
    };
    window.addEventListener("chatai:workspace-files-changed", listen);
    try {
      await vfs.writeFile("/mnt/a.txt", "hello");
      await vfs.mkdir("/mnt/new");
      await vfs.remove("/mnt/a.txt");
      await vfs.writeFile("/root-new.txt", "hello");
    } finally {
      window.removeEventListener("chatai:workspace-files-changed", listen);
    }
    expect(seen).toEqual([
      "workspace-1",
      "workspace-1",
      "workspace-1",
      "workspace-1",
    ]);
  });

  it("routes append and rename into a mount's own provider", async () => {
    const { root } = makeRoot();
    const mounted = makeMountProvider();
    const vfs = new WorkspaceAgentVfs(
      emptyConversation,
      "workspace-1",
      root,
      [{ mount: mount(false), provider: mounted.provider }],
    );

    await vfs.appendFile("/mnt/a.txt", "more");
    const target = await vfs.rename("/mnt/a.txt", "b.txt");

    expect(mounted.calls.append).toEqual(["/a.txt"]);
    expect(mounted.calls.rename).toEqual([["/a.txt", "b.txt"]]);
    expect(target).toBe("/mnt/b.txt");
  });

  it("falls back to read and write when the provider cannot append", async () => {
    const { root } = makeRoot();
    const mounted = makeMountProvider();
    delete (mounted.provider as unknown as { append?: unknown }).append;
    const vfs = new WorkspaceAgentVfs(
      emptyConversation,
      "workspace-1",
      root,
      [{ mount: mount(false), provider: mounted.provider }],
    );

    await vfs.appendFile("/mnt/a.txt", "more");

    expect(mounted.calls.append).toEqual([]);
    expect(mounted.calls.write).toEqual(["/a.txt"]);
    expect(mounted.written).toBe("more");
  });

  it("refuses append and rename on a read-only mount", async () => {
    const { root } = makeRoot();
    const mounted = makeMountProvider();
    const vfs = new WorkspaceAgentVfs(
      emptyConversation,
      "workspace-1",
      root,
      [{ mount: mount(true), provider: mounted.provider }],
    );

    await expect(vfs.appendFile("/mnt/a.txt", "more")).rejects.toThrow(
      "That mount is read-only.",
    );
    await expect(vfs.rename("/mnt/a.txt", "b.txt")).rejects.toThrow(
      "That mount is read-only.",
    );
    await expect(vfs.rename("/mnt", "elsewhere")).rejects.toThrow(
      "That mount is read-only.",
    );
    expect(mounted.calls.append).toEqual([]);
    expect(mounted.calls.rename).toEqual([]);
  });

  it("refuses to rename the mount point or the workspace root", async () => {
    const { root } = makeRoot();
    const mounted = makeMountProvider();
    const vfs = new WorkspaceAgentVfs(
      emptyConversation,
      "workspace-1",
      root,
      [{ mount: mount(false), provider: mounted.provider }],
    );

    await expect(vfs.rename("/mnt", "elsewhere")).rejects.toThrow(
      "Cannot rename the mount point /mnt",
    );
    await expect(vfs.rename("/", "elsewhere")).rejects.toThrow(
      "The workspace root cannot be renamed",
    );
    expect(mounted.calls.rename).toEqual([]);
  });

  it("appends and renames through the workspace root provider", async () => {
    const { root, calls } = makeRoot();
    const vfs = new WorkspaceAgentVfs(emptyConversation, "workspace-1", root, []);

    await vfs.appendFile("/notes.md", "more");
    const target = await vfs.rename("/notes.md", "final.md");

    expect(calls.append).toEqual(["/notes.md"]);
    expect(calls.rename).toEqual([["/notes.md", "final.md"]]);
    expect(target).toBe("/final.md");
  });

  it("keeps conversation uploads on the chat's own storage", async () => {
    const { root, calls } = makeRoot();
    const uploads: string[] = [];
    const renames: [string, string][] = [];
    const conversation: Vfs = {
      ...emptyConversation,
      appendFile: async (path) => {
        uploads.push(path);
      },
      rename: async (path, newName) => {
        renames.push([path, newName]);
        return path.replace(/[^/]+$/, newName);
      },
    };
    const vfs = new WorkspaceAgentVfs(conversation, "workspace-1", root, []);

    await vfs.appendFile("/uploads/file.txt", "more");
    const target = await vfs.rename("/uploads/file.txt", "renamed.txt");

    expect(uploads).toEqual(["/uploads/file.txt"]);
    expect(renames).toEqual([["/uploads/file.txt", "renamed.txt"]]);
    expect(calls.append).toEqual([]);
    expect(calls.rename).toEqual([]);
    expect(target).toBe("/uploads/renamed.txt");
  });

  it("stays quiet for conversation uploads, which are not workspace rows", async () => {
    const { root } = makeRoot();
    const uploads: string[] = [];
    const conversation: Vfs = {
      ...emptyConversation,
      writeFile: async (path) => {
        uploads.push(path);
      },
    };
    const vfs = new WorkspaceAgentVfs(conversation, "workspace-1", root, []);
    let fired = 0;
    const listen = () => {
      fired += 1;
    };
    window.addEventListener("chatai:workspace-files-changed", listen);
    try {
      await vfs.writeFile("/uploads/file.txt", "hello");
    } finally {
      window.removeEventListener("chatai:workspace-files-changed", listen);
    }
    expect(uploads).toEqual(["/uploads/file.txt"]);
    expect(fired).toBe(0);
  });
});
