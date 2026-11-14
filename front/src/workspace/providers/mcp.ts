import type { WorkspaceCapabilities, WorkspaceFileEntry } from "../../db/dbTypes";
import { READ_ONLY_CAPABILITIES } from "../capabilities";
import { baseName, joinPath, normalizePath } from "../paths";
import type { DirectoryPage, FileProvider, QuotaInfo } from "./types";
import { WorkspaceError } from "./types";

const LIST_TOOLS = ["list_directory", "list_files", "filesystem_list_directory"];
const READ_TOOLS = ["read_file", "filesystem_read_file"];
const WRITE_TOOLS = ["write_file", "filesystem_write_file"];
const DELETE_TOOLS = ["delete_file", "filesystem_delete_file"];
const MKDIR_TOOLS = ["create_directory", "make_directory"];
const MOVE_TOOLS = ["move_file", "filesystem_move_file"];
const COPY_TOOLS = ["copy_file", "filesystem_copy_file"];

const pick = (tools: Set<string>, names: string[]) =>
  names.find((name) => tools.has(name));

const toBytes = (data: Uint8Array): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

export class McpProvider implements FileProvider {
  readonly kind = "mcp" as const;
  capabilities: WorkspaceCapabilities = { ...READ_ONLY_CAPABILITIES };
  status: "connected" | "needs-permission" | "offline" | "error" = "offline";
  private client: any = null;
  private tools = new Set<string>();
  private allowlist: string[] = [];

  constructor(
    readonly sourceId: string,
    readonly endpoint: string,
    readonly transport: "streamable-http" | "sse",
    allowlist: string[] = [],
  ) {
    this.allowlist = allowlist;
  }

  async connect() {
    const [{ Client }, transportModule] = await Promise.all([
      import("@modelcontextprotocol/sdk/client/index.js"),
      this.transport === "sse"
        ? import("@modelcontextprotocol/sdk/client/sse.js")
        : import("@modelcontextprotocol/sdk/client/streamableHttp.js"),
    ]);
    const Transport =
      this.transport === "sse"
        ? transportModule.SSEClientTransport
        : transportModule.StreamableHTTPClientTransport;
    const client = new Client({ name: "chat-ai-workspace", version: "1.0.0" });
    const transport = new Transport(new URL(this.endpoint));
    try {
      await client.connect(transport);
      const tools: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined);
        for (const tool of page.tools ?? []) tools.push(tool.name);
        cursor = page.nextCursor;
      } while (cursor);
      this.client = client;
      this.tools = new Set(
        tools.filter(
          (name) => !this.allowlist.length || this.allowlist.includes(name),
        ),
      );
      this.capabilities = {
        ...READ_ONLY_CAPABILITIES,
        read: !!pick(this.tools, READ_TOOLS),
        write: !!pick(this.tools, WRITE_TOOLS),
        delete: !!pick(this.tools, DELETE_TOOLS),
        mkdir: !!pick(this.tools, MKDIR_TOOLS),
        move: !!pick(this.tools, MOVE_TOOLS),
        copy: !!pick(this.tools, COPY_TOOLS),
        rename: false,
        quota: false,
      };
      if (!pick(this.tools, LIST_TOOLS) || !pick(this.tools, READ_TOOLS)) {
        this.status = "error";
        throw new WorkspaceError(
          "UNSUPPORTED",
          "The MCP server exposes no file listing/read tools",
        );
      }
      this.status = "connected";
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      this.status = "error";
      throw new WorkspaceError(
        "OFFLINE",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  close() {
    this.client?.close?.();
    this.client = null;
  }

  private async call(tool: string | undefined, args: Record<string, unknown>) {
    if (!tool) throw new WorkspaceError("UNSUPPORTED");
    try {
      const result = await this.client.callTool({ name: tool, arguments: args });
      return result;
    } catch (error) {
      throw new WorkspaceError(
        "PROVIDER_ERROR",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async list(path: string, cursor?: string): Promise<DirectoryPage> {
    const result = await this.call(pick(this.tools, LIST_TOOLS), {
      path: normalizePath(path),
      cursor,
    });
    const payload = result?.structuredContent ?? result;
    const rawEntries = Array.isArray(payload?.entries)
      ? payload.entries
      : Array.isArray(payload)
        ? payload
        : [];
    const entries: WorkspaceFileEntry[] = rawEntries.map((entry: any) => ({
      sourceId: this.sourceId,
      path: normalizePath(entry.path ?? joinPath(path, entry.name ?? "")),
      name: String(entry.name ?? baseName(entry.path ?? "")),
      kind: entry.type === "dir" || entry.isDirectory ? "dir" : "file",
      size: typeof entry.size === "number" ? entry.size : undefined,
      mtime: entry.mtime,
      mime: entry.mime,
    }));
    return { entries, next: payload?.next };
  }

  async stat(path: string): Promise<WorkspaceFileEntry> {
    const normalized = normalizePath(path);
    if (normalized === "/") {
      return { sourceId: this.sourceId, path: "/", name: "/", kind: "dir" };
    }
    const parent = await this.list(normalized.split("/").slice(0, -1).join("/") || "/");
    const entry = parent.entries.find(
      (item) => item.name === baseName(normalized),
    );
    if (!entry) throw new WorkspaceError("NOT_FOUND", normalized);
    return entry;
  }

  async read(path: string) {
    const result = await this.call(pick(this.tools, READ_TOOLS), {
      path: normalizePath(path),
    });
    const payload = result?.structuredContent ?? result;
    const content = payload?.content ?? payload?.data ?? payload;
    if (content instanceof Uint8Array) return toBytes(content);
    if (content instanceof ArrayBuffer) return toBytes(new Uint8Array(content));
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .map((part: any) => (part?.type === "text" ? part.text : ""))
              .join("")
          : String(content ?? "");
    return toBytes(new TextEncoder().encode(text));
  }

  async write(
    path: string,
    data: ReadableStream<Uint8Array>,
    opts: { size?: number; overwrite: boolean },
  ): Promise<WorkspaceFileEntry> {
    if (!this.capabilities.write) throw new WorkspaceError("UNSUPPORTED");
    const reader = data.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const bytes = new Uint8Array(chunks.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of chunks) {
      bytes.set(part, offset);
      offset += part.length;
    }
    await this.call(pick(this.tools, WRITE_TOOLS), {
      path: normalizePath(path),
      content: new TextDecoder().decode(bytes),
      overwrite: opts.overwrite,
    });
    return this.stat(path);
  }

  async mkdir(path: string) {
    await this.call(pick(this.tools, MKDIR_TOOLS), { path: normalizePath(path) });
  }

  async remove(path: string, opts: { recursive: boolean }) {
    await this.call(pick(this.tools, DELETE_TOOLS), {
      path: normalizePath(path),
      recursive: opts.recursive,
    });
  }

  async move(from: string, to: string) {
    await this.call(pick(this.tools, MOVE_TOOLS), {
      from: normalizePath(from),
      to: normalizePath(to),
    });
  }

  async copy(from: string, to: string) {
    await this.call(pick(this.tools, COPY_TOOLS), {
      from: normalizePath(from),
      to: normalizePath(to),
    });
  }

  async quota(): Promise<QuotaInfo | null> {
    return null;
  }
}
