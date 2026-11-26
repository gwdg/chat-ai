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
  // `${collection}\0${filename}` -> bytes staged so far by upload_file_chunk
  staged: new Map<string, Uint8Array>(),
  members: new Map<string, any[]>(),
  calls: [] as { name: string; args: Record<string, any> }[],
  connectError: null as Error | null,
  connectCalls: 0,
  staleSessionFailures: 0,
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
      rag.connectCalls += 1;
      if (rag.connectError) throw rag.connectError;
    }
    async listTools() {
      return { tools: rag.tools.map((name) => ({ name })) };
    }
    async callTool(request: { name: string; arguments: Record<string, any> }) {
      if (rag.staleSessionFailures > 0) {
        rag.staleSessionFailures -= 1;
        // What the streamable HTTP transport throws when the service forgot the
        // session id: the SDK keeps sending the dead id and never clears it.
        throw new Error(
          'Streamable HTTP error: Error POSTing to endpoint: {"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"Session not found"}}',
        );
      }
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
        case "upload_file_chunk": {
          // What the service does: the offset has to match the bytes staged so
          // far, and only the last chunk stores the file.
          const key = `${collection}\0${filename}`;
          const offset = Number(request.arguments.offset);
          const last = Boolean(request.arguments.last);
          const chunk = Uint8Array.from(
            atob(String(request.arguments.chunk_base64)),
            (c) => c.charCodeAt(0),
          );
          const staged = rag.staged.get(key) ?? new Uint8Array(0);
          if (offset !== staged.length) {
            return failure(
              `chunk offset ${offset} does not match ${staged.length} bytes already uploaded`,
            );
          }
          const next = new Uint8Array(staged.length + chunk.length);
          next.set(staged, 0);
          next.set(chunk, staged.length);
          if (!last) {
            rag.staged.set(key, next);
            return json({ status: "partial", received: next.length });
          }
          rag.staged.delete(key);
          let files = rag.files.get(collection);
          if (!files) {
            files = new Map();
            rag.files.set(collection, files);
          }
          files.set(filename, next);
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
  "upload_file_chunk",
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
    rag.staged = new Map();
    rag.calls = [];
    rag.connectError = null;
    rag.connectCalls = 0;
    rag.staleSessionFailures = 0;
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

  it("sends a file in 1 MiB chunks instead of one oversized request", async () => {
    const ragProvider = provider();
    const size = 2 * 1024 * 1024 + 512 * 1024;
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i += 1) data[i] = i % 251;

    const entry = await ragProvider.write("/recipes/big.pdf", streamOf(data), {
      overwrite: true,
    });

    // The MCP server refuses request bodies above 4 MiB, so a big file must
    // never go out as one upload_file_base64 call.
    expect(rag.calls.some((call) => call.name === "upload_file_base64")).toBe(
      false,
    );
    const chunks = rag.calls.filter(
      (call) => call.name === "upload_file_chunk",
    );
    expect(chunks.map((call) => call.args.offset)).toEqual([
      0,
      1024 * 1024,
      2 * 1024 * 1024,
    ]);
    expect(chunks.map((call) => call.args.last)).toEqual([false, false, true]);
    expect(chunks.map((call) => call.args.filename)).toEqual([
      "big.pdf",
      "big.pdf",
      "big.pdf",
    ]);
    expect(entry.size).toBe(size);
    expect(rag.files.get("alice__recipes")!.get("big.pdf")).toEqual(data);
  });

  it("closes an exact multiple of the chunk size with an empty final chunk", async () => {
    const ragProvider = provider();
    const data = new Uint8Array(1024 * 1024).fill(7);

    await ragProvider.write("/recipes/exact.bin", streamOf(data), {
      overwrite: true,
    });

    const chunks = rag.calls.filter(
      (call) => call.name === "upload_file_chunk",
    );
    expect(chunks.map((call) => call.args.offset)).toEqual([0, 1024 * 1024]);
    expect(chunks.map((call) => call.args.last)).toEqual([false, true]);
    expect(atob(String(chunks[1].args.chunk_base64))).toBe("");
    expect(rag.files.get("alice__recipes")!.get("exact.bin")).toEqual(data);
  });

  it("creates a zero-byte file with one empty final chunk", async () => {
    const ragProvider = provider();
    await ragProvider.write("/recipes/empty.bin", streamOf(new Uint8Array()), {
      overwrite: true,
    });

    const chunks = rag.calls.filter(
      (call) => call.name === "upload_file_chunk",
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].args).toMatchObject({ offset: 0, last: true });
    expect(rag.files.get("alice__recipes")!.get("empty.bin")).toHaveLength(0);
  });

  it("falls back to one whole-file request when the service has no chunk tool", async () => {
    rag.tools = ALL_TOOLS.filter((tool) => tool !== "upload_file_chunk");
    const ragProvider = provider();

    await ragProvider.write("/recipes/notes.md", streamOf("small"), {
      overwrite: true,
    });

    expect(rag.calls.some((call) => call.name === "upload_file_base64")).toBe(
      true,
    );
    expect(rag.calls.some((call) => call.name === "upload_file_chunk")).toBe(
      false,
    );
    expect(
      decoder.decode(rag.files.get("alice__recipes")!.get("notes.md")),
    ).toBe("small");
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

  it("reconnects once when saia-rag dropped the MCP session", async () => {
    const ragProvider = provider();
    await ragProvider.connect();
    const handshakes = rag.connectCalls;

    // A restarted service answers the dead session id with 404 "Session not
    // found", which the SDK does not repair on its own.
    rag.staleSessionFailures = 1;
    const page = await ragProvider.list("/");

    expect(page.entries.map((entry) => entry.name)).toEqual([
      "recipes",
      "bob__papers",
    ]);
    expect(rag.connectCalls).toBe(handshakes + 1);
  });

  it("surfaces the failure when a fresh session is rejected too", async () => {
    const ragProvider = provider();
    await ragProvider.connect();
    const handshakes = rag.connectCalls;
    rag.staleSessionFailures = 99;

    await expect(ragProvider.list("/")).rejects.toMatchObject({
      code: "AUTH_EXPIRED",
      message: expect.stringContaining("Session not found"),
    });
    expect(rag.connectCalls).toBe(handshakes + 1);
  });
});
