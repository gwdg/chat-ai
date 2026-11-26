import { beforeEach, describe, expect, it, vi } from "vitest";

import { readAll, streamOf } from "../bytes";
import { SaiaFsProvider } from "../providers/saiaFs";

// The provider talks MCP through the SDK; these mocks replace the transport with
// a tiny in-memory filesystem that answers the same tools saia-fs exposes.
const sdk = vi.hoisted(() => ({
  tools: [] as string[],
  files: new Map<string, Uint8Array>(),
  dirs: new Set<string>(),
  calls: [] as { name: string; args: Record<string, any> }[],
  connectError: null as Error | null,
  connectCalls: 0,
  sessionError: null as string | null,
}));

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const json = (value: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});
const text = (value: string) => ({ content: [{ type: "text", text: value }] });

const parentOf = (path: string) =>
  path.split("/").slice(0, -1).join("/") || "/";

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    async connect() {
      sdk.connectCalls += 1;
      if (sdk.connectError) throw sdk.connectError;
    }
    async listTools() {
      return { tools: sdk.tools.map((name) => ({ name })) };
    }
    async callTool(request: { name: string; arguments: Record<string, any> }) {
      sdk.calls.push({ name: request.name, args: request.arguments });
      const path = String(request.arguments?.path ?? "");
      switch (request.name) {
        case "list_json": {
          if (!sdk.dirs.has(path) && path !== "/") {
            return json({ path, error: "not found" });
          }
          const names = new Set<string>();
          for (const dir of sdk.dirs) {
            if (dir !== "/" && parentOf(dir) === path) names.add(dir);
          }
          for (const file of sdk.files.keys()) {
            if (parentOf(file) === path) names.add(file);
          }
          return json({
            path,
            entries: [...names]
              .map((name) => ({
                name: name.split("/").pop(),
                type: sdk.dirs.has(name) ? "dir" : "file",
                size: sdk.files.get(name)?.length ?? 0,
                modified: 1700000000,
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          });
        }
        case "list": {
          if (!sdk.dirs.has(path) && path !== "/") {
            return text(`not found: ${path}`);
          }
          const lines: string[] = [];
          for (const file of sdk.files.keys()) {
            if (parentOf(file) === path) {
              lines.push(`f  ${file.split("/").pop()}  ${sdk.files.get(file)!.length}b`);
            }
          }
          for (const dir of sdk.dirs) {
            if (dir !== "/" && parentOf(dir) === path) {
              lines.push(`d  ${dir.split("/").pop()}  0b`);
            }
          }
          return text(lines.length ? lines.join("\n") : `${path}: empty`);
        }
        case "read_base64": {
          const data = sdk.files.get(path);
          if (!data) return json({ path, error: "not found" });
          return json({
            path,
            encoding: "base64",
            size: data.length,
            content: btoa(String.fromCharCode(...data)),
          });
        }
        case "read": {
          const data = sdk.files.get(path);
          if (!data) return text(`not found: ${path}`);
          // saia-fs decodes UTF-8 with errors="replace".
          return text(new TextDecoder("utf-8").decode(data));
        }
        case "write_base64":
        case "write": {
          const data =
            request.name === "write"
              ? encoder.encode(String(request.arguments?.content ?? ""))
              : Uint8Array.from(atob(String(request.arguments?.content ?? "")), (c) =>
                  c.charCodeAt(0),
                );
          sdk.files.set(path, data);
          sdk.dirs.add(parentOf(path));
          return request.name === "write"
            ? text(`written: ${path}`)
            : json({ path, written: true, size: data.length });
        }
        case "exists":
          if (sdk.sessionError) {
            return {
              content: [{ type: "text", text: sdk.sessionError }],
              isError: true,
            };
          }
          return text(sdk.files.has(path) || sdk.dirs.has(path) ? "yes" : "no");
        case "info": {
          const data = sdk.files.get(path);
          if (!data && !sdk.dirs.has(path)) return text(`not found: ${path}`);
          return text(
            `path=${path}  type=${data ? "file" : "dir"}  size=${data?.length ?? 0}  modified=1700000000`,
          );
        }
        case "mkdir":
          sdk.dirs.add(path);
          return text(`created: ${path}`);
        case "delete":
          sdk.files.delete(path);
          sdk.dirs.delete(path);
          return text(`deleted: ${path}`);
        case "move":
          sdk.files.set(request.arguments.dst, sdk.files.get(path)!);
          sdk.files.delete(path);
          return text(`moved: ${path} -> ${request.arguments.dst}`);
        case "append": {
          const existing = sdk.files.get(path) ?? new Uint8Array();
          const addition = encoder.encode(
            String(request.arguments?.content ?? ""),
          );
          const combined = new Uint8Array(existing.length + addition.length);
          combined.set(existing, 0);
          combined.set(addition, existing.length);
          sdk.files.set(path, combined);
          sdk.dirs.add(parentOf(path));
          return text(`appended: ${path}`);
        }
        case "rename": {
          if (!sdk.files.has(path) && !sdk.dirs.has(path)) {
            return text(`not found: ${path}`);
          }
          const nextName = String(request.arguments?.new_name ?? "");
          const next = `${parentOf(path) === "/" ? "" : parentOf(path)}/${nextName}`;
          if (sdk.files.has(next) || sdk.dirs.has(next)) {
            return text(`error: destination already exists: ${nextName}`);
          }
          if (sdk.files.has(path)) {
            sdk.files.set(next, sdk.files.get(path)!);
            sdk.files.delete(path);
          } else {
            sdk.dirs.delete(path);
            sdk.dirs.add(next);
          }
          return text(`renamed: ${path} -> ${next}`);
        }
        default:
          return text(`unknown tool ${request.name}`);
      }
    }
    async close() {}
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: class {
    constructor(readonly url: URL) {}
  },
}));

const ALL_TOOLS = [
  "list",
  "list_json",
  "read",
  "read_base64",
  "write",
  "write_base64",
  "delete",
  "mkdir",
  "exists",
  "move",
  "append",
  "rename",
  "info",
];

const useTools = (...names: string[]) => {
  sdk.tools = names;
};

const connect = async () => {
  const provider = new SaiaFsProvider("source-1");
  await provider.connect();
  // The handshake ends with one `exists` session check; start the call log after
  // it so a test's own tool assertions see only the calls it made.
  sdk.calls = [];
  return provider;
};

beforeEach(() => {
  sdk.tools = [...ALL_TOOLS];
  sdk.files = new Map();
  sdk.dirs = new Set();
  sdk.calls = [];
  sdk.connectError = null;
  sdk.connectCalls = 0;
  sdk.sessionError = null;
});

describe("SaiaFsProvider", () => {
  it("takes its capabilities from the tools the instance offers", async () => {
    const provider = await connect();

    expect(provider.status).toBe("connected");
    expect(provider.capabilities).toMatchObject({
      read: true,
      write: true,
      append: true,
      delete: true,
      mkdir: true,
      move: true,
      // No copy tool, no range request, and the account folder's size is unknown.
      copy: false,
      rename: true,
      range: false,
      quota: false,
    });
  });

  it("reports an instance without binary tools as text-only", async () => {
    useTools("list", "read", "write", "delete", "mkdir", "move");

    const provider = await connect();

    expect(provider.capabilities.read).toBe(true);
    expect(provider.capabilities.write).toBe(true);
    // `write` can append text and `move` can rename in place, so both are offered.
    expect(provider.capabilities.append).toBe(true);
    expect(provider.capabilities.rename).toBe(true);
  });

  it("reads the account folder through back's proxy", async () => {
    useTools("list_json");
    const provider = await connect();

    expect(provider.capabilities.read).toBe(false);
    expect(provider.capabilities.write).toBe(false);
    expect(provider.capabilities.append).toBe(false);
    expect(provider.capabilities.rename).toBe(false);
  });

  it("treats a fresh account's missing root as an empty folder", async () => {
    const provider = await connect();

    await expect(provider.list("/")).resolves.toEqual({ entries: [] });
    await expect(provider.list("/notes")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lists entries with their size and modification time", async () => {
    sdk.dirs.add("/notes");
    sdk.files.set("/notes/a.txt", encoder.encode("hi"));
    const provider = await connect();

    const page = await provider.list("/");

    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]).toMatchObject({
      path: "/notes",
      name: "notes",
      kind: "dir",
      sourceId: "source-1",
    });
    const inner = await provider.list("/notes");
    expect(inner.entries[0]).toMatchObject({
      name: "a.txt",
      kind: "file",
      size: 2,
      mtime: new Date(1700000000 * 1000).toISOString(),
    });
  });

  it("round-trips binary content byte for byte", async () => {
    const provider = await connect();
    const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);

    await provider.write("/blobs/one.bin", streamOf(bytes), {
      size: bytes.length,
      overwrite: false,
    });
    const read = await readAll(await provider.read("/blobs/one.bin"));

    expect(Array.from(read)).toEqual(Array.from(bytes));
  });

  it("refuses to overwrite an existing file unless overwrite is set", async () => {
    const provider = await connect();
    sdk.files.set("/notes/a.txt", encoder.encode("old"));

    await expect(
      provider.write("/notes/a.txt", streamOf(new Uint8Array([1])), {
        overwrite: false,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await provider.write("/notes/a.txt", streamOf(encoder.encode("new")), {
      overwrite: true,
    });
    expect(decoder.decode(sdk.files.get("/notes/a.txt"))).toBe("new");
  });

  it("creates folders, moves and deletes through their own tools", async () => {
    const provider = await connect();

    await provider.mkdir("/drafts");
    sdk.files.set("/drafts/a.txt", encoder.encode("x"));
    await provider.move("/drafts/a.txt", "/drafts/b.txt");
    await provider.remove("/drafts/b.txt", { recursive: false });

    expect(sdk.files.has("/drafts/b.txt")).toBe(false);
    expect(sdk.calls.map((call) => call.name)).toEqual([
      "mkdir",
      "move",
      "delete",
    ]);
    expect(sdk.calls[1].args).toEqual({
      src: "/drafts/a.txt",
      dst: "/drafts/b.txt",
    });
  });

  it("appends text through its own tool", async () => {
    const provider = await connect();
    sdk.files.set("/notes/a.txt", encoder.encode("first\n"));

    await provider.append("/notes/a.txt", "second\n");

    expect(sdk.calls.map((call) => call.name)).toEqual(["append"]);
    expect(sdk.calls[0].args).toEqual({
      path: "/notes/a.txt",
      content: "second\n",
    });
    expect(decoder.decode(sdk.files.get("/notes/a.txt"))).toBe(
      "first\nsecond\n",
    );
  });

  it("rewrites the whole file in base64 for a binary append", async () => {
    const provider = await connect();
    sdk.files.set("/blobs/a.bin", new Uint8Array([0x89, 0x50]));

    await provider.append("/blobs/a.bin", new Uint8Array([0xff, 0x00]));

    expect(sdk.calls.map((call) => call.name)).toEqual([
      "read_base64",
      "write_base64",
    ]);
    expect(Array.from(sdk.files.get("/blobs/a.bin")!)).toEqual([
      0x89, 0x50, 0xff, 0x00,
    ]);
  });

  it("renames in place and refuses a name that is taken", async () => {
    const provider = await connect();
    sdk.files.set("/notes/a.txt", encoder.encode("a"));
    sdk.files.set("/notes/b.txt", encoder.encode("b"));

    await provider.rename("/notes/a.txt", "c.txt");
    expect(sdk.files.has("/notes/c.txt")).toBe(true);
    expect(sdk.calls.at(-1)).toEqual({
      name: "rename",
      args: { path: "/notes/a.txt", new_name: "c.txt" },
    });

    await expect(
      provider.rename("/notes/c.txt", "b.txt"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("falls back to move for a rename, checking the destination first", async () => {
    useTools("list", "read", "write", "delete", "mkdir", "exists", "move");
    const provider = await connect();
    sdk.files.set("/notes/a.txt", encoder.encode("a"));
    sdk.files.set("/notes/b.txt", encoder.encode("b"));

    await expect(
      provider.rename("/notes/a.txt", "b.txt"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(sdk.calls.some((call) => call.name === "move")).toBe(false);

    await provider.rename("/notes/a.txt", "c.txt");
    expect(sdk.files.has("/notes/c.txt")).toBe(true);
  });

  it("refuses a rename whose name is a path or the storage root", async () => {
    const provider = await connect();
    sdk.files.set("/notes/a.txt", encoder.encode("a"));

    await expect(
      provider.rename("/notes/a.txt", "other/c.txt"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
    await expect(provider.rename("/", "root")).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
    expect(sdk.calls).toEqual([]);
  });

  it("falls back to the text tools on an instance without the JSON pair", async () => {
    useTools("list", "read", "write", "delete", "mkdir", "exists", "move");
    const provider = await connect();
    // A name that itself contains two spaces is exactly what the text format's
    // `name  sizeb` split gets wrong; the line parser must keep it intact.
    sdk.dirs.add("/notes");
    sdk.files.set("/notes/two  spaces.txt", encoder.encode("hi"));

    const page = await provider.list("/notes");

    expect(page.entries).toEqual([
      expect.objectContaining({ name: "two  spaces.txt", kind: "file", size: 2 }),
    ]);
  });

  it("refuses text tools for binary content instead of corrupting it", async () => {
    useTools("list", "read", "write", "delete", "mkdir", "exists", "move");
    const provider = await connect();
    sdk.files.set("/images/a.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff]));

    await expect(provider.read("/images/a.png")).rejects.toMatchObject({
      code: "UNSUPPORTED",
    });
    await expect(
      provider.write("/images/b.png", streamOf(new Uint8Array([0xff, 0xfe])), {
        overwrite: true,
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });

  it("accepts UTF-8 text through the text write tool", async () => {
    useTools("list", "read", "write", "delete", "mkdir", "exists", "move");
    const provider = await connect();

    await provider.write("/notes/grüße.txt", streamOf(encoder.encode("hallo")), {
      overwrite: false,
    });

    expect(decoder.decode(sdk.files.get("/notes/grüße.txt"))).toBe("hallo");
  });

  it("reports an unreachable instance as offline, naming the endpoint", async () => {
    sdk.connectError = new TypeError("Failed to fetch");

    const provider = new SaiaFsProvider("source-1", "http://localhost:8081/mcp/saia-fs/mcp");

    await expect(provider.connect()).rejects.toMatchObject({ code: "OFFLINE" });
    expect(provider.status).toBe("error");
    await expect(provider.connect()).rejects.toThrow(/localhost:8081\/mcp\/saia-fs\/mcp/);
  });

  it("names a missing identity instead of a bare fetch error", async () => {
    sdk.connectError = new Error("401 Unauthorized: no user identified");

    const provider = new SaiaFsProvider("source-1");

    await expect(provider.connect()).rejects.toThrow(/rejected the request for this user/);
  });

  it("explains a failed connect when the browser lists the source", async () => {
    // The workspace keeps a provider whose connect failed, then asks it for the
    // root. That must report the handshake failure, not "UNSUPPORTED list".
    sdk.connectError = new TypeError("Failed to fetch");

    const provider = new SaiaFsProvider("source-1", "http://localhost:8081/mcp/saia-fs/mcp");
    await expect(provider.connect()).rejects.toMatchObject({ code: "OFFLINE" });

    await expect(provider.list("/")).rejects.toMatchObject({
      code: "OFFLINE",
      message: expect.stringContaining("Failed to fetch"),
    });
  });

  it("shares one handshake between concurrent connects", async () => {
    const provider = new SaiaFsProvider("source-1");

    await Promise.all([provider.connect(), provider.connect()]);
    await provider.connect();

    expect(sdk.connectCalls).toBe(1);
  });

  it("turns a failing session check into a reason the source card can show", async () => {
    // saia-fs answers an unhandled exception (e.g. a missing identity header)
    // with the bare "Error executing tool exists", which looked like an empty
    // folder in the browser.
    sdk.sessionError = "Error executing tool exists";
    const provider = new SaiaFsProvider("source-1", "http://localhost:8081/mcp/saia-fs/mcp");

    await expect(provider.connect()).rejects.toMatchObject({
      code: "AUTH_EXPIRED",
      message: expect.stringContaining("x-auth-claim-uid"),
    });
    expect(provider.status).toBe("error");
  });
});
