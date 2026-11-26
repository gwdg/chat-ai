import { beforeEach, describe, expect, it, vi } from "vitest";

import { readAll, streamOf, toBase64 } from "../bytes";
import { SaiaRagProvider } from "../providers/saiaRag";

// The provider talks MCP through the SDK. These mocks replace both the client
// and the transport with an in-memory saia-rag that answers the same tools the
// service exposes, so the provider's JSON shapes, roles and base64 handling are
// exercised without a network.
const rag = vi.hoisted(() => ({
  tools: [] as string[],
  collections: [] as any[],
  // collection storage name -> file name -> bytes
  files: new Map<string, Map<string, Uint8Array>>(),
  members: new Map<string, any[]>(),
  calls: [] as { name: string; args: Record<string, any> }[],
  connectError: null as Error | null,
}));

const json = (value: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});
const text = (value: string) => ({ content: [{ type: "text", text: value }] });
const failure = (value: string) => ({
  isError: true,
  content: [{ type: "text", text: value }],
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    async connect() {
      if (rag.connectError) throw rag.connectError;
    }
    async listTools() {
      return { tools: rag.tools.map((name) => ({ name })) };
    }
    async callTool(request: { name: string; arguments: Record<string, any> }) {
      rag.calls.push({ name: request.name, args: request.arguments });
      const collection = String(request.arguments?.collection ?? "");
      const filename = String(request.arguments?.filename ?? "");
      switch (request.name) {
        case "list_collections":
          return json({ collections: rag.collections });
        case "list_files": {
          const files = rag.files.get(collection);
          if (!files) return failure(`Collection '${collection}' not found`);
          return json({
            collection,
            files: [...files.entries()].map(([name, bytes]) => ({
              name,
              size: bytes.length,
              status: "indexed",
              chunks: 1,
            })),
          });
        }
        case "read_file_base64": {
          const bytes = rag.files.get(collection)?.get(filename);
          if (!bytes) return failure(`${filename} is not in this collection`);
          return json({
            collection,
            filename,
            size: bytes.length,
            content_base64: toBase64(bytes),
          });
        }
        case "upload_file_base64": {
          let files = rag.files.get(collection);
          if (!files) {
            files = new Map();
            rag.files.set(collection, files);
          }
          files.set(
            filename,
            Uint8Array.from(atob(String(request.arguments.content_base64)), (c) =>
              c.charCodeAt(0),
            ),
          );
          return text(`Stored ${filename}`);
        }
        case "create_collection": {
          const name = String(request.arguments.collection);
          rag.collections.push({
            name,
            collection: `alice__${name}`,
            owner: "alice",
            role: "owner",
            can_write: true,
            can_manage: true,
            shared: false,
          });
          rag.files.set(`alice__${name}`, new Map());
          return text(`Created '${name}'.`);
        }
        case "delete_collection": {
          rag.collections = rag.collections.filter(
            (row) => row.collection !== collection,
          );
          rag.files.delete(collection);
          return text(`Deleted '${collection}'.`);
        }
        case "list_members":
          return json({
            collection,
            members: rag.members.get(collection) ?? [],
          });
        case "add_member": {
          const rows = rag.members.get(collection) ?? [];
          rows.push({
            user: request.arguments.principal,
            role: request.arguments.role,
            kind: request.arguments.kind,
          });
          rag.members.set(collection, rows);
          return text("ok");
        }
        case "remove_member": {
          const rows = (rag.members.get(collection) ?? []).filter(
            (row) => row.user !== request.arguments.principal,
          );
          rag.members.set(collection, rows);
          return text("ok");
        }
        default:
          return failure(`Unknown tool ${request.name}`);
      }
    }
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: class {
    constructor(readonly url: URL) {}
  },
}));

const ALL_TOOLS = [
  "list_collections",
  "list_files",
  "read_file_base64",
  "upload_file_base64",
  "create_collection",
  "delete_collection",
  "list_members",
  "add_member",
  "remove_member",
];

const ownCollection = {
  name: "recipes",
  collection: "alice__recipes",
  owner: "alice",
  role: "owner",
  can_write: true,
  can_manage: true,
  shared: false,
};

const sharedReadOnly = {
  name: "papers",
  collection: "bob__papers",
  owner: "bob",
  role: "reader",
  can_write: false,
  can_manage: false,
  shared: true,
};

describe("SaiaRagProvider", () => {
  beforeEach(() => {
    rag.tools = [...ALL_TOOLS];
    rag.collections = [{ ...ownCollection }, { ...sharedReadOnly }];
    rag.files = new Map([
      ["alice__recipes", new Map([["notes.md", encoder.encode("# hi")]])],
      ["bob__papers", new Map([["paper.pdf", encoder.encode("%PDF")]])],
    ]);
    rag.members = new Map([
      ["alice__recipes", [{ user: "alice", role: "owner", kind: "user" }]],
    ]);
    rag.calls = [];
    rag.connectError = null;
  });

  const provider = () => new SaiaRagProvider("rag-1", "http://localhost:9000/mcp");

  it("lists collections at the root, qualifying shared ones with their owner", async () => {
    const ragProvider = provider();
    const page = await ragProvider.list("/");

    expect(page.entries.map((entry) => entry.name)).toEqual(["recipes", "bob__papers"]);
    expect(page.entries[0]).toMatchObject({ kind: "dir", path: "/recipes" });
    expect(page.entries[0].readOnly).toBeFalsy();
    expect(page.entries[1]).toMatchObject({ kind: "dir", path: "/bob__papers" });
    // A reader-only collection is marked read-only, so the tree locks it.
    expect(page.entries[1].readOnly).toBe(true);
  });

  it("lists the files of one collection", async () => {
    const ragProvider = provider();
    const page = await ragProvider.list("/recipes");

    expect(page.entries).toEqual([
      expect.objectContaining({
        name: "notes.md",
        path: "/recipes/notes.md",
        kind: "file",
        readOnly: false,
      }),
    ]);
  });

  it("addresses a shared collection by its storage name and its own role", async () => {
    const ragProvider = provider();
    const page = await ragProvider.list("/bob__papers");

    expect(page.entries[0]).toMatchObject({
      name: "paper.pdf",
      path: "/bob__papers/paper.pdf",
      readOnly: true,
    });
    expect(rag.calls).toContainEqual({
      name: "list_files",
      args: { collection: "bob__papers" },
    });
  });

  it("reads and writes bytes through the base64 tools", async () => {
    const ragProvider = provider();
    const bytes = await readAll(await ragProvider.read("/recipes/notes.md"));
    expect(decoder.decode(bytes)).toBe("# hi");

    await ragProvider.write("/recipes/notes.md", streamOf("second"), {
      overwrite: true,
    });
    expect(decoder.decode(rag.files.get("alice__recipes")!.get("notes.md"))).toBe(
      "second",
    );
  });

  it("refuses a write into a read-only collection before touching the service", async () => {
    const ragProvider = provider();
    await expect(
      ragProvider.write("/bob__papers/paper.pdf", streamOf("x"), {
        overwrite: true,
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(rag.calls.some((call) => call.name === "upload_file_base64")).toBe(
      false,
    );
  });

  it("creates a file on a first append and concatenates afterwards", async () => {
    const ragProvider = provider();
    await ragProvider.append("/recipes/log.txt", "one");
    await ragProvider.append("/recipes/log.txt", encoder.encode("-two"));

    expect(decoder.decode(rag.files.get("alice__recipes")!.get("log.txt"))).toBe(
      "one-two",
    );
  });

  it("creates a collection and returns its owner row", async () => {
    const ragProvider = provider();
    const created = await ragProvider.createCollection("  drafts  ");

    expect(created).toMatchObject({ name: "drafts", role: "owner" });
    expect(rag.calls).toContainEqual({
      name: "create_collection",
      args: { collection: "drafts" },
    });
  });

  it("deletes a collection only when the caller may manage it", async () => {
    const ragProvider = provider();
    await ragProvider.deleteCollection("recipes");
    expect(rag.calls).toContainEqual({
      name: "delete_collection",
      args: { collection: "alice__recipes" },
    });

    await expect(ragProvider.deleteCollection("bob__papers")).rejects.toMatchObject(
      { code: "PERMISSION_DENIED" },
    );
  });

  it("lists, adds and removes members for an owner", async () => {
    const ragProvider = provider();
    expect(await ragProvider.listMembers("recipes")).toEqual([
      { user: "alice", role: "owner", kind: "user" },
    ]);

    await ragProvider.addMember("recipes", "carol@example.org", "editor", "user");
    await ragProvider.addMember("recipes", "hpc-team", "reader", "group");
    expect(rag.members.get("alice__recipes")).toEqual([
      { user: "alice", role: "owner", kind: "user" },
      { user: "carol@example.org", role: "editor", kind: "user" },
      { user: "hpc-team", role: "reader", kind: "group" },
    ]);

    await ragProvider.removeMember("recipes", "carol@example.org");
    expect(rag.members.get("alice__recipes")).toHaveLength(2);
  });

  it("refuses member changes on a collection the caller does not own", async () => {
    const ragProvider = provider();
    await expect(
      ragProvider.addMember("bob__papers", "carol", "editor", "user"),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("keeps collection creation and per-file deletion out of the tree", async () => {
    const ragProvider = provider();
    expect(ragProvider.capabilities).toMatchObject({
      read: true,
      write: true,
      append: true,
      delete: false,
      mkdir: false,
      rename: false,
      move: false,
      copy: false,
    });
    await expect(ragProvider.mkdir("/recipes/folder")).rejects.toMatchObject({
      code: "UNSUPPORTED",
    });
    await expect(
      ragProvider.remove("/recipes/notes.md", { recursive: false }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });

  it("reports a refused session instead of listing nothing", async () => {
    rag.tools = ALL_TOOLS.filter((tool) => tool !== "list_collections");
    const ragProvider = provider();

    await expect(ragProvider.list("/")).rejects.toMatchObject({
      code: "UNSUPPORTED",
    });
  });

  it("reports a connect failure once and does not keep a client", async () => {
    rag.connectError = new Error("Failed to fetch");
    const ragProvider = provider();

    await expect(ragProvider.list("/")).rejects.toMatchObject({ code: "OFFLINE" });
    expect(ragProvider.status).toBe("error");
  });
});
