import { beforeEach, describe, expect, it, vi } from "vitest";

import { readAll, streamOf, toBase64 } from "../bytes";
import {
  SaiaRagProvider,
  resetSaiaRagCollectionCache,
} from "../providers/saiaRag";

// The provider talks MCP through the SDK. These mocks replace both the client
// and the transport with an in-memory saia-rag that answers the same tools the
// service exposes, so the provider's JSON shapes, roles and base64 handling are
// exercised without a network.
const rag = vi.hoisted(() => ({
  tools: [] as string[],
  collections: [] as any[],
  // collection storage name -> file name -> bytes
  files: new Map<string, Map<string, Uint8Array>>(),
  // collection storage name -> file name -> tags
  tags: new Map<string, Map<string, string[]>>(),
  // `${collection}\0${filename}` for files whose indexed text is Markdown
  markdown: new Set<string>(),
  // `${collection}\0${filename}` -> the indexed Markdown of a converted file
  markdownText: new Map<string, string>(),
  // `${collection}\0${filename}` -> bytes staged so far by upload_file_chunk
  staged: new Map<string, Uint8Array>(),
  members: new Map<string, any[]>(),
  // collection storage name -> public read flag
  publicRead: new Map<string, boolean>(),
  calls: [] as { name: string; args: Record<string, any> }[],
  connectError: null as Error | null,
  connectCalls: 0,
  staleSessionFailures: 0,
  callError: null as Error | null,
  /** Raw bytes a chunk may carry; a larger one answers 413 like a proxy would. */
  chunkLimit: null as number | null,
  /**
   * Raw bytes the tool itself stages (`stage_chunk`); a larger piece is refused
   * by the tool with a message naming the limit, not with the proxy's 413.
   */
  stagedLimit: null as number | null,
  /**
   * The next `list_collections` waits for this before answering, so a test can
   * hold a read in flight while another call changes the list.
   */
  listGate: null as Promise<void> | null,
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
      if (rag.callError) throw rag.callError;
      if (rag.staleSessionFailures > 0) {
        rag.staleSessionFailures -= 1;
        // What the streamable HTTP transport throws when the service forgot the
        // session id: the SDK keeps sending the dead id and never clears it.
        throw new Error(
          'Streamable HTTP error: Error POSTing to endpoint: {"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"Session not found"}}',
        );
      }
      rag.calls.push({ name: request.name, args: request.arguments });
      const reference = String(request.arguments?.collection ?? "");
      // The service takes `owner/name` and stores `owner__name`; the fake keys
      // its maps by the storage form, so resolve the reference the same way.
      const collection = reference.replace("/", "__");
      const filename = String(request.arguments?.filename ?? "");
      switch (request.name) {
        case "list_collections": {
          // The rows are what the service read when the request arrived; a
          // collection created while the call is in flight is not in them.
          const rows = rag.collections.map((row) => ({ ...row }));
          const gate = rag.listGate;
          rag.listGate = null;
          if (gate) await gate;
          return json({ collections: rows });
        }
        case "list_files": {
          const files = rag.files.get(collection);
          if (!files) return failure(`Collection '${collection}' not found`);
          const tags = rag.tags.get(collection);
          return json({
            collection,
            files: [...files.entries()].map(([name, bytes]) => ({
              name,
              size: bytes.length,
              status: "indexed",
              chunks: 1,
              markdown: rag.markdown.has(`${collection}\0${name}`),
              ...(request.arguments?.include_tags
                ? { tags: tags?.get(name) ?? [] }
                : {}),
            })),
          });
        }
        case "get_file_tags": {
          const fileTags = rag.tags.get(collection)?.get(filename);
          if (!fileTags?.length) return text(`'${filename}' has no tags.`);
          return text(fileTags.join(", "));
        }
        case "list_tags": {
          const counts = new Map<string, number>();
          for (const fileTags of rag.tags.get(collection)?.values() ?? []) {
            for (const tag of fileTags) {
              counts.set(tag, (counts.get(tag) ?? 0) + 1);
            }
          }
          if (!counts.size) return text("No tags in this collection.");
          return text(
            [...counts.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([tag, count]) => `${tag} (${count})`)
              .join("\n"),
          );
        }
        case "set_file_tags": {
          let tags = rag.tags.get(collection);
          if (!tags) {
            tags = new Map();
            rag.tags.set(collection, tags);
          }
          tags.set(filename, request.arguments.tags);
          return json({
            collection,
            filename,
            tags: request.arguments.tags,
          });
        }
        case "tag_file": {
          let tags = rag.tags.get(collection);
          if (!tags) {
            tags = new Map();
            rag.tags.set(collection, tags);
          }
          const current = tags.get(filename) ?? [];
          const merged = [...new Set([...current, ...request.arguments.tags])];
          tags.set(filename, merged);
          return text(`Tagged '${filename}': ${merged.join(", ")}`);
        }
        case "remove_file": {
          rag.files.get(collection)?.delete(filename);
          rag.tags.get(collection)?.delete(filename);
          return text(`Removed '${filename}' from '${collection}'.`);
        }
        case "upload_file": {
          let files = rag.files.get(collection);
          if (!files) {
            files = new Map();
            rag.files.set(collection, files);
          }
          files.set(filename, encoder.encode(request.arguments.content));
          return text(`Stored '${filename}'.`);
        }
        case "index_collection":
          return json({ collection, job_id: "job-7", status: "running" });
        case "search_chunks":
          return text(
            "[notes.md score=0.870]\nfirst chunk\n\n[paper.pdf score=0.310]\nsecond chunk",
          );
        case "search_documents":
          return text("1. notes.md (score=0.870)\n2. paper.pdf (score=0.310)");
        case "search_preview":
          return text(
            "1. notes.md (score=0.870)\n# hi\n\n2. paper.pdf (score=0.310)\n%PDF",
          );
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
        case "get_file": {
          const markdown = rag.markdownText.get(`${collection}\0${filename}`);
          if (markdown === undefined) {
            return failure(`${filename} is not in this collection`);
          }
          return text(markdown);
        }
        case "upload_file_base64": {
          let files = rag.files.get(collection);
          if (!files) {
            files = new Map();
            rag.files.set(collection, files);
          }
          files.set(
            filename,
            Uint8Array.from(
              Buffer.from(String(request.arguments.content_base64), "base64"),
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
            Buffer.from(String(request.arguments.chunk_base64), "base64"),
          );
          if (rag.chunkLimit !== null && chunk.length > rag.chunkLimit) {
            throw new Error(
              "Streamable HTTP error: Error POSTing to endpoint (HTTP 413): Request body too large",
            );
          }
          // The service's own cap, worded like saia_rag.uploads.stage_chunk.
          if (rag.stagedLimit !== null && chunk.length > rag.stagedLimit) {
            return failure(
              `chunk is ${chunk.length} bytes; send at most ${rag.stagedLimit} bytes per chunk`,
            );
          }
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
            public: false,
            description: String(request.arguments.description ?? "")
              .split(/\s+/)
              .filter(Boolean)
              .join(" "),
          });
          rag.files.set(`alice__${name}`, new Map());
          return text(`Created '${name}'.`);
        }
        case "set_collection_description": {
          const row = rag.collections.find(
            (entry) => entry.collection === collection,
          );
          if (!row) return failure(`Collection '${collection}' not found`);
          const kept = String(request.arguments.description ?? "")
            .split(/\s+/)
            .filter(Boolean)
            .join(" ")
            .slice(0, 280);
          row.description = kept;
          return text(`The description is now: ${kept}`);
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
        case "set_public_read": {
          rag.publicRead.set(collection, request.arguments.public === true);
          const row = rag.collections.find(
            (entry) => entry.collection === collection,
          );
          if (row) row.public = request.arguments.public === true;
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
  "get_file",
  "upload_file_base64",
  "upload_file_chunk",
  "upload_file",
  "create_collection",
  "delete_collection",
  "remove_file",
  "index_collection",
  "list_members",
  "add_member",
  "remove_member",
  "set_public_read",
  "set_collection_description",
  "list_tags",
  "get_file_tags",
  "tag_file",
  "set_file_tags",
  "search_chunks",
  "search_documents",
  "search_preview",
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
    // The collection list is cached across instances for the page, so every
    // test starts from a cold one.
    resetSaiaRagCollectionCache();
    rag.tools = [...ALL_TOOLS];
    rag.collections = [{ ...ownCollection }, { ...sharedReadOnly }];
    rag.files = new Map([
      ["alice__recipes", new Map([["notes.md", encoder.encode("# hi")]])],
      ["bob__papers", new Map([["paper.pdf", encoder.encode("%PDF")]])],
    ]);
    rag.members = new Map([
      ["alice__recipes", [{ user: "alice", role: "owner", kind: "user" }]],
    ]);
    rag.publicRead = new Map();
    rag.tags = new Map([
      ["alice__recipes", new Map([["notes.md", ["recipe", "quick"]]])],
    ]);
    rag.staged = new Map();
    rag.markdown = new Set();
    rag.markdownText = new Map();
    rag.calls = [];
    rag.connectError = null;
    rag.connectCalls = 0;
    rag.staleSessionFailures = 0;
    rag.callError = null;
    rag.chunkLimit = null;
    rag.stagedLimit = null;
  });

  const provider = () => new SaiaRagProvider("rag-1", "http://localhost:9000/mcp");
  const listCalls = () =>
    rag.calls.filter((call) => call.name === "list_collections").length;

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

  it("reuses the list a closed provider read, so a re-opened dialog does not re-list", async () => {
    const first = provider();
    await first.listCollections();
    first.close();

    const second = provider();
    await expect(second.listCollections()).resolves.toHaveLength(2);
    // One list read served both providers: opening "Manage workspace" again
    // must not pay the service's slowest call a second time.
    expect(listCalls()).toBe(1);
  });

  it("serves the list a create wrote, not the one it replaced", async () => {
    const first = provider();
    await first.listCollections();
    await first.createCollection("drafts");
    first.close();

    const second = provider();
    const rows = await second.listCollections();
    // The create refreshed the shared copy, so the second provider answers
    // without another call — and already carries the new collection.
    expect(listCalls()).toBe(2);
    expect(rows.map((row) => row.name)).toContain("drafts");
  });

  it("lists the files of one collection", async () => {
    const ragProvider = provider();
    const page = await ragProvider.list("/recipes");

    expect(page.entries).toEqual([
      expect.objectContaining({
        name: "notes.md",
        path: "/recipes/notes.md",
        kind: "file",
        // The collection lists names only; the name supplies the type.
        mime: "text/markdown",
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
      // The name is the only type signal a flat collection gives.
      mime: "application/pdf",
      readOnly: true,
    });
    expect(rag.calls).toContainEqual({
      name: "list_files",
      args: { collection: "bob/papers" },
    });
  });

  it("downloads a converted document as its indexed Markdown", async () => {
    rag.markdown.add("alice__recipes\0Wasserwerksschulung.pdf");
    rag.markdownText.set(
      "alice__recipes\0Wasserwerksschulung.pdf",
      "# Wasserwerksschulung\n\nDie Wasserwerke prüfen täglich.",
    );
    rag.files.get("alice__recipes")!.set(
      "Wasserwerksschulung.pdf",
      encoder.encode("%PDF-1.7"),
    );
    const ragProvider = provider();
    const listed = await ragProvider.listFiles("recipes");
    const file = listed.find((row) => row.name === "Wasserwerksschulung.pdf")!;

    // The service reports the converted text, so the client can offer it.
    expect(file).toMatchObject({ markdown: true });

    const saved = await ragProvider.downloadFile("recipes", file);
    expect(saved.name).toBe("Wasserwerksschulung.md");
    await expect(saved.blob.text()).resolves.toContain("prüfen");
  });

  it("downloads an unconverted upload as its stored bytes", async () => {
    const ragProvider = provider();
    const file = {
      name: "notes.md",
      status: "indexed",
      chunks: 1,
      tags: [],
      markdown: false,
    };

    const saved = await ragProvider.downloadFile("recipes", file);

    expect(saved.name).toBe("notes.md");
    await expect(saved.blob.text()).resolves.toBe("# hi");
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

  it("sends a file in bounded chunks instead of one oversized request", async () => {
    const ragProvider = provider();
    const size = 4 * 1024 * 1024 + 512 * 1024;
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
      3 * 1024 * 1024,
      4 * 1024 * 1024,
    ]);
    expect(chunks.map((call) => call.args.last)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(chunks.map((call) => call.args.filename)).toEqual([
      "big.pdf",
      "big.pdf",
      "big.pdf",
      "big.pdf",
      "big.pdf",
    ]);
    expect(entry.size).toBe(size);
    expect(rag.files.get("alice__recipes")!.get("big.pdf")).toEqual(data);
  });

  it("reports the stored bytes after each accepted chunk", async () => {
    const ragProvider = provider();
    const size = 2 * 1024 * 1024 + 512 * 1024;
    const data = new Uint8Array(size);
    const progress: [number, number][] = [];

    await ragProvider.write("/recipes/big.pdf", streamOf(data), {
      overwrite: true,
      size,
      onProgress: (sent, total) => progress.push([sent, total]),
    });

    // Zero on the first frame, then only accepted chunks: a stalled upload
    // cannot look complete, and the label moves as soon as it is clicked.
    expect(progress).toEqual([
      [0, size],
      [1024 * 1024, size],
      [2 * 1024 * 1024, size],
      [size, size],
    ]);
  });

  it("does not list the collection before an overwriting write", async () => {
    const ragProvider = provider();

    // The upload replaces the file anyway, so the pre-flight existence check
    // only costs a round trip (and, on a big collection, a big listing) before
    // the first byte is sent.
    await ragProvider.write("/recipes/notes.md", streamOf("new"), {
      overwrite: true,
    });

    expect(rag.calls.some((call) => call.name === "list_files")).toBe(false);
  });

  it("refuses a write the caller did not mark as overwriting", async () => {
    const ragProvider = provider();

    const failure = await ragProvider
      .write("/recipes/notes.md", streamOf("new"), { overwrite: false })
      .catch((error) => error);

    expect(failure.code).toBe("CONFLICT");
    expect(rag.calls.some((call) => call.name === "upload_file_chunk")).toBe(
      false,
    );
  });

  it("retries a chunk a proxy rejected with half the size", async () => {
    // A deployment whose proxy caps the body below the service's own 4 MiB.
    rag.chunkLimit = 512 * 1024;
    const ragProvider = provider();
    const size = 3 * 1024 * 1024;
    const data = new Uint8Array(size).fill(3);

    await ragProvider.write("/recipes/big.pdf", streamOf(data), {
      overwrite: true,
      size,
    });

    const chunks = rag.calls.filter((call) => call.name === "upload_file_chunk");
    // The refused 1 MiB attempt advanced nothing, so offset 0 is sent again as
    // 512 KiB pieces and the rest follows at that size.
    expect(chunks.map((call) => call.args.offset)).toEqual([
      0,
      0,
      512 * 1024,
      1024 * 1024,
      1536 * 1024,
      2 * 1024 * 1024,
      2560 * 1024,
      3 * 1024 * 1024,
    ]);
    expect(rag.files.get("alice__recipes")!.get("big.pdf")).toEqual(data);

    // The accepted size is remembered, so the next upload does not pay for the
    // same rejected request.
    rag.calls = [];
    await ragProvider.write(
      "/recipes/other.pdf",
      streamOf(new Uint8Array(2 * 1024 * 1024)),
      { overwrite: true },
    );
    const next = rag.calls.filter((call) => call.name === "upload_file_chunk");
    expect(next.map((call) => call.args.offset)).toEqual([
      0,
      512 * 1024,
      1024 * 1024,
      1536 * 1024,
      2 * 1024 * 1024,
    ]);
  });

  it("retries at the size the service itself announced", async () => {
    // A service whose staging cap is below the app's 1 MiB chunk. It names the
    // size it accepts, so the retry lands on 768 KiB instead of halving twice
    // towards it (the message carries the answer).
    rag.stagedLimit = 768 * 1024;
    const ragProvider = provider();
    const size = 3 * 1024 * 1024;
    const data = new Uint8Array(size).fill(5);

    await ragProvider.write("/recipes/big.pdf", streamOf(data), {
      overwrite: true,
      size,
    });

    const chunks = rag.calls.filter((call) => call.name === "upload_file_chunk");
    // Nothing was staged by the refused 1 MiB piece, so offset 0 is sent again —
    // at exactly the announced size.
    expect(chunks.map((call) => call.args.offset)).toEqual([
      0,
      0,
      768 * 1024,
      1536 * 1024,
      2304 * 1024,
      3 * 1024 * 1024,
    ]);
    expect(rag.files.get("alice__recipes")!.get("big.pdf")).toEqual(data);

    // The next file of the same session goes straight to the accepted size.
    rag.calls = [];
    await ragProvider.write(
      "/recipes/other.pdf",
      streamOf(new Uint8Array(1536 * 1024)),
      { overwrite: true },
    );
    const next = rag.calls.filter((call) => call.name === "upload_file_chunk");
    // 1536 KiB at 768 KiB per piece: two full chunks and the empty tail.
    expect(next.map((call) => call.args.offset)).toEqual([
      0,
      768 * 1024,
      1536 * 1024,
    ]);
  });

  it("surfaces a chunk cap below the floor instead of shrinking forever", async () => {
    // A cap under MIN_CHUNK_BYTES cannot be met, so retrying must stop and let
    // the service's own message through rather than loop.
    rag.stagedLimit = 8 * 1024;
    const ragProvider = provider();

    const failure = await ragProvider
      .write("/recipes/tiny-limit.bin", streamOf(new Uint8Array(512 * 1024)), {
        overwrite: true,
      })
      .catch((error) => error);

    expect(failure.code).toBe("PROVIDER_ERROR");
    expect(failure.message).toContain("send at most 8192 bytes per chunk");
    expect(
      rag.calls.filter((call) => call.name === "upload_file_chunk").length,
    ).toBeLessThan(4);
  });

  it("names the tool and the timeout when the service never answers", async () => {
    const ragProvider = provider();
    // The handshake has to succeed first: a failing session check is reported
    // as a missing identity header, which is a different problem.
    await ragProvider.list("/");
    // What the MCP SDK rejects with once its 60 s request timeout expires.
    rag.callError = new Error("MCP error -32001: Request timed out");

    const failure = await ragProvider.listFiles("recipes").catch((error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure.code).toBe("PROVIDER_ERROR");
    expect(failure.message).toContain("list_files");
    expect(failure.message).toContain("60 s");
    // The raw SDK text alone does not say which tool stalled.
    expect(failure.message).not.toBe("MCP error -32001: Request timed out");
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

  it("seeds the drive's listing with the handshake's own read", async () => {
    const ragProvider = provider();
    await ragProvider.connect();
    expect(listCalls()).toBe(1);

    // The drive used to ask `list_collections` again right after the session
    // check — the most expensive call the service has.
    const page = await ragProvider.list("/");
    expect(page.entries.map((entry) => entry.name)).toEqual([
      "recipes",
      "bob__papers",
    ]);
    expect(listCalls()).toBe(1);
  });

  it("shares one collection read between concurrent asks", async () => {
    const ragProvider = provider();
    await ragProvider.connect();
    ragProvider.invalidateCollections();

    // A source that is still connecting can be listed by more than one caller
    // (the drive effect re-runs while the provider map is republished).
    const [collections, page] = await Promise.all([
      ragProvider.listCollections(),
      ragProvider.list("/"),
    ]);
    expect(collections.map((collection) => collection.name)).toEqual([
      "recipes",
      "papers",
    ]);
    expect(page.entries).toHaveLength(2);
    expect(listCalls()).toBe(2);
  });

  it("asks again after an explicit invalidation", async () => {
    const ragProvider = provider();
    await ragProvider.list("/");
    expect(listCalls()).toBe(1);

    ragProvider.invalidateCollections();
    await ragProvider.list("/");
    expect(listCalls()).toBe(2);
  });

  it("re-reads the collections once the cache window has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const ragProvider = provider();
      await ragProvider.list("/");
      expect(listCalls()).toBe(1);

      vi.setSystemTime(Date.now() + 10_000);
      await ragProvider.list("/");
      expect(listCalls()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reads a freshly created collection instead of the cached list", async () => {
    const ragProvider = provider();
    await ragProvider.list("/");
    expect(listCalls()).toBe(1);

    const created = await ragProvider.createCollection("drafts");
    // The public reference is `owner/name`; `collectionOf` rewrites the
    // service's `owner__name` storage spelling.
    expect(created).toMatchObject({ collection: "alice/drafts" });
    // Creating writes the list, so the read behind it bypasses the cache.
    expect(listCalls()).toBe(2);
    const page = await ragProvider.list("/");
    expect(page.entries.map((entry) => entry.name)).toContain("drafts");
    expect(listCalls()).toBe(2);
  });

  it("does not answer a create with a read that started before it", async () => {
    const ragProvider = provider();
    await ragProvider.connect();
    ragProvider.invalidateCollections();

    // Hold the next read so it is still in flight when the collection is
    // created: saia-rag computed its answer before the new row existed.
    let release!: () => void;
    rag.listGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stale = ragProvider.listCollections();

    const created = await ragProvider.createCollection("drafts");
    expect(created).toMatchObject({ name: "drafts", role: "owner" });

    // The older answer lands afterwards and must not replace the new list.
    release();
    expect((await stale).map((collection) => collection.name)).toEqual([
      "recipes",
      "papers",
    ]);
    const page = await ragProvider.list("/");
    expect(page.entries.map((entry) => entry.name)).toEqual([
      "recipes",
      "bob__papers",
      "drafts",
    ]);
  });

  it("deletes a collection only when the caller may manage it", async () => {
    const ragProvider = provider();
    await ragProvider.deleteCollection("recipes");
    expect(rag.calls).toContainEqual({
      name: "delete_collection",
      args: { collection: "alice/recipes" },
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

  it("reports the service's public read flag on a collection", async () => {
    rag.collections = [{ ...ownCollection, public: true }];
    const ragProvider = provider();

    const [row] = await ragProvider.listCollections();
    expect(row.public).toBe(true);
  });

  it("turns public read on and off through the owner-only tool", async () => {
    const ragProvider = provider();
    await ragProvider.listCollections();

    await ragProvider.setPublicRead("recipes", true);
    expect(rag.calls).toContainEqual({
      name: "set_public_read",
      args: { collection: "alice/recipes", public: true },
    });
    expect(rag.publicRead.get("alice__recipes")).toBe(true);

    await ragProvider.setPublicRead("recipes", false);
    expect(rag.publicRead.get("alice__recipes")).toBe(false);

    await expect(
      ragProvider.setPublicRead("bob__papers", true),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("only offers public read when the service advertises the tool", async () => {
    const ragProvider = provider();
    await ragProvider.listCollections();
    expect(ragProvider.supportsPublicRead()).toBe(true);

    rag.tools = ALL_TOOLS.filter((tool) => tool !== "set_public_read");
    resetSaiaRagCollectionCache();
    const older = provider();
    await older.listCollections();
    expect(older.supportsPublicRead()).toBe(false);
  });

  it("reads a collection's description from the service", async () => {
    rag.collections = [
      { ...ownCollection, description: "Peer-reviewed papers" },
    ];
    const ragProvider = provider();

    const [row] = await ragProvider.listCollections();
    expect(row.description).toBe("Peer-reviewed papers");
  });

  it("reports an empty description when the service does not send one", async () => {
    // A service older than the description table has no field at all.
    const ragProvider = provider();
    const [row] = await ragProvider.listCollections();
    expect(row.description).toBe("");
  });

  it("stores a description on create and on a later edit", async () => {
    const ragProvider = provider();

    const created = await ragProvider.createCollection(
      "drafts",
      "  Notes   for the draft ",
    );
    expect(created?.description).toBe("Notes for the draft");
    expect(rag.calls).toContainEqual({
      name: "create_collection",
      args: { collection: "drafts", description: "Notes   for the draft" },
    });

    const kept = await ragProvider.setCollectionDescription(
      "drafts",
      "  Edited   text ",
    );
    // What the service kept is what the caller gets back, and the cached list
    // carries it too.
    expect(kept).toBe("Edited text");
    expect(rag.calls).toContainEqual({
      name: "set_collection_description",
      args: { collection: "alice/drafts", description: "Edited   text" },
    });
    const rows = await ragProvider.listCollections();
    expect(
      rows.find((row) => row.name === "drafts")?.description,
    ).toBe("Edited text");
  });

  it("refuses a description edit on a collection it cannot write to", async () => {
    rag.collections = [{ ...sharedReadOnly }];
    const ragProvider = provider();

    await expect(
      ragProvider.setCollectionDescription("bob__papers", "Mine now"),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("keeps collection-level operations out of the tree but allows per-file removal", async () => {
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
    await ragProvider.remove("/recipes/notes.md");
    expect(rag.files.get("alice__recipes")!.has("notes.md")).toBe(false);
  });

  it("reads per-file tags in the listing call when the service offers it", async () => {
    const ragProvider = provider();
    const files = await ragProvider.listFiles("recipes", { includeTags: true });

    expect(files[0]).toMatchObject({
      name: "notes.md",
      tags: ["recipe", "quick"],
    });
    expect(rag.calls).toContainEqual({
      name: "list_files",
      args: { collection: "alice/recipes", include_tags: true },
    });
    expect(rag.calls.some((call) => call.name === "get_file_tags")).toBe(false);
  });

  it("falls back to one tag call per file on an older service", async () => {
    rag.tools = ALL_TOOLS.filter((tool) => tool !== "set_file_tags");
    const ragProvider = provider();
    const files = await ragProvider.listFiles("recipes");

    expect(files[0].tags).toEqual(["recipe", "quick"]);
    expect(
      rag.calls.filter((call) => call.name === "get_file_tags"),
    ).toHaveLength(1);
  });

  it("replaces a file's tags and can clear them", async () => {
    const ragProvider = provider();

    expect(
      await ragProvider.setFileTags("recipes", "notes.md", ["soup"]),
    ).toEqual(["soup"]);
    expect(rag.calls).toContainEqual({
      name: "set_file_tags",
      args: { collection: "alice/recipes", filename: "notes.md", tags: ["soup"] },
    });

    expect(await ragProvider.setFileTags("recipes", "notes.md", [])).toEqual([]);
    expect(rag.tags.get("alice__recipes")!.get("notes.md")).toEqual([]);
  });

  it("adds tags through tag_file when replacing is not offered", async () => {
    rag.tools = ALL_TOOLS.filter((tool) => tool !== "set_file_tags");
    const ragProvider = provider();

    expect(
      await ragProvider.setFileTags("recipes", "notes.md", ["new"]),
    ).toEqual(["recipe", "quick", "new"]);
    expect(rag.calls).toContainEqual({
      name: "tag_file",
      args: { collection: "alice/recipes", filename: "notes.md", tags: ["new"] },
    });
  });

  it("lists the tags of a collection with their counts", async () => {
    const ragProvider = provider();
    expect(await ragProvider.listTags("recipes")).toEqual([
      { name: "quick", count: 1 },
      { name: "recipe", count: 1 },
    ]);
  });

  it("removes a file together with its tags", async () => {
    const ragProvider = provider();
    await ragProvider.removeFile("recipes", "notes.md");

    expect(rag.calls).toContainEqual({
      name: "remove_file",
      args: { collection: "alice/recipes", filename: "notes.md" },
    });
    expect(rag.files.get("alice__recipes")!.has("notes.md")).toBe(false);
    expect(rag.tags.get("alice__recipes")!.has("notes.md")).toBe(false);
  });

  it("stores a text file through upload_file", async () => {
    const ragProvider = provider();
    await ragProvider.uploadTextFile("recipes", "new.md", "# new");

    expect(rag.calls).toContainEqual({
      name: "upload_file",
      args: {
        collection: "alice/recipes",
        filename: "new.md",
        content: "# new",
      },
    });
    expect(
      decoder.decode(rag.files.get("alice__recipes")!.get("new.md")),
    ).toBe("# new");
  });

  it("starts indexing and returns the service's job id", async () => {
    const ragProvider = provider();
    expect(await ragProvider.indexCollection("recipes")).toBe("job-7");
    expect(rag.calls).toContainEqual({
      name: "index_collection",
      args: { collection: "alice/recipes" },
    });
  });

  it("searches with the tool for the chosen mode and parses the hits", async () => {
    const ragProvider = provider();

    const previews = await ragProvider.search(
      "recipes",
      "hi",
      "previews",
      3,
      ["recipe"],
    );
    expect(rag.calls).toContainEqual({
      name: "search_preview",
      args: {
        collection: "alice/recipes",
        query: "hi",
        count: 3,
        tags: ["recipe"],
      },
    });
    expect(previews.results).toEqual([
      { filename: "notes.md", score: 0.87, text: "# hi" },
      { filename: "paper.pdf", score: 0.31, text: "%PDF" },
    ]);

    const chunks = await ragProvider.search("recipes", "hi", "chunks");
    expect(rag.calls).toContainEqual({
      name: "search_chunks",
      args: { collection: "alice/recipes", query: "hi", count: 5 },
    });
    expect(chunks.results[0]).toMatchObject({
      filename: "notes.md",
      text: "first chunk",
    });

    const documents = await ragProvider.search("recipes", "hi", "documents");
    expect(rag.calls).toContainEqual({
      name: "search_documents",
      args: { collection: "alice/recipes", query: "hi", count: 5 },
    });
    expect(documents.results.map((hit) => hit.filename)).toEqual([
      "notes.md",
      "paper.pdf",
    ]);
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
    // The handshake's own read seeded the list cache, so the drive would not
    // call the service at all; forget it to exercise the dropped session.
    ragProvider.invalidateCollections();
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
    ragProvider.invalidateCollections();

    await expect(ragProvider.list("/")).rejects.toMatchObject({
      code: "AUTH_EXPIRED",
      message: expect.stringContaining("Session not found"),
    });
    expect(rag.connectCalls).toBe(handshakes + 1);
  });
});
