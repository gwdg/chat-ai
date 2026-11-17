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
  };
  return { root: root as unknown as BrowserProvider, calls };
};

const makeMountProvider = (write = true) => {
  const calls = {
    list: [] as string[],
    write: [] as string[],
    mkdir: [] as string[],
    remove: [] as string[],
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
    expect(mounted.calls).toEqual({
      list: [],
      write: [],
      mkdir: [],
      remove: [],
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
});
