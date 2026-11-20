import type {
  WorkspaceCapabilities,
  WorkspaceFileEntry,
} from "../../db/dbTypes";
import { saiaFsMcpUrl } from "../../apis/saiaFs";
import { authHeaders } from "../../apis/authHeaders";
import { READ_ONLY_CAPABILITIES } from "../capabilities";
import { fromBase64, readAll, streamOf, toBase64 } from "../bytes";
import { baseName, joinPath, normalizePath } from "../paths";
import type { DirectoryPage, FileProvider, QuotaInfo } from "./types";
import { WorkspaceError } from "./types";

/**
 * The SAIA filesystem, reached through `saiaFsEndpoint` or, when that is unset,
 * the deployment's `/saia-fs` route.
 *
 * saia-fs is an MCP server behind the SAIA registry's HTTP listener, which is
 * not published; the deployment forwards the MCP exchange and adds the user's
 * identity (`x-auth-claim-uid`). A stack without that hop configures
 * `saiaFsEndpoint` and sends the header itself. One account folder is shared by
 * every workspace, because the folder belongs to the user, not to a workspace.
 *
 * Its tool names and answers differ from the generic filesystem MCP servers
 * (`providers/mcp.ts`): `list` answers the text `"d  name  12b"`, `read`/`write`
 * are UTF-8 text only, and `move` takes `src`/`dst`. A binary-safe pair
 * (`read_base64`/`write_base64`) and a `list_json` exist on newer instances and
 * are used when the server offers them, so the source still works against an
 * older one — text only, and it says so instead of corrupting a file.
 */
const LIST_TOOL = "list";
const LIST_JSON_TOOL = "list_json";
const READ_TOOL = "read";
const READ_BASE64_TOOL = "read_base64";
const WRITE_TOOL = "write";
const WRITE_BASE64_TOOL = "write_base64";
const DELETE_TOOL = "delete";
const MKDIR_TOOL = "mkdir";
const MOVE_TOOL = "move";
const INFO_TOOL = "info";
const EXISTS_TOOL = "exists";

// `d  name  12b`: the name is lazy so a name that itself contains spaces still
// matches, and the size is anchored at the end.
const TEXT_ENTRY = /^([df])\s+(.*?)\s+(\d+)b$/;

const parseJson = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const textOf = (result: any): string => {
  const content = result?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (part?.type === "text" ? String(part.text ?? "") : ""))
      .join("");
  }
  return String(content ?? "");
};

const isAuthFailure = (message: string): boolean =>
  /no user identified|invalid user name|identityerror|401|unauthori[sz]ed|forbidden/i.test(
    message,
  );

const explainConnect = (error: unknown, endpoint: string): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (isAuthFailure(message)) {
    return `SAIA rejected the request for this user (${message})`;
  }
  return `${message} (${endpoint})`;
};

export class SaiaFsProvider implements FileProvider {
  readonly kind = "saia-fs" as const;
  capabilities: WorkspaceCapabilities = { ...READ_ONLY_CAPABILITIES };
  status: "connected" | "needs-permission" | "offline" | "error" = "offline";

  private client: any = null;
  private tools = new Set<string>();
  private connectPromise: Promise<void> | null = null;
  private connectError: Error | null = null;

  constructor(
    readonly sourceId: string,
    readonly endpoint: string = saiaFsMcpUrl(),
  ) {}

  private has(tool: string): boolean {
    return this.tools.has(tool);
  }

  /**
   * Idempotent: two callers asking at the same time share one MCP handshake,
   * and a provider that is already connected is not reconnected (a second
   * `connect` would open another session and leave the first one dangling).
   */
  async connect(): Promise<void> {
    if (this.client) return;
    if (!this.connectPromise) {
      this.connectPromise = this.open().finally(() => {
        this.connectPromise = null;
      });
    }
    return this.connectPromise;
  }

  private async open(): Promise<void> {
    const [{ Client }, transportModule] = await Promise.all([
      import("@modelcontextprotocol/sdk/client/index.js"),
      import("@modelcontextprotocol/sdk/client/streamableHttp.js"),
    ]);
    const client = new Client({ name: "chat-ai-workspace", version: "1.0.0" });
    const transport = new transportModule.StreamableHTTPClientTransport(
      new URL(this.endpoint),
      // The caller's headers go along so the deployment's proxy sees the
      // request as the same user; it reduces them to the uid it adds upstream.
      // The service is never called directly.
      { requestInit: { headers: authHeaders() } },
    );
    try {
      await client.connect(transport);
      const tools: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined);
        for (const tool of page.tools ?? []) tools.push(tool.name);
        cursor = page.nextCursor;
      } while (cursor);
      if (!tools.includes(LIST_JSON_TOOL) && !tools.includes(LIST_TOOL)) {
        throw new WorkspaceError(
          "UNSUPPORTED",
          "The SAIA filesystem offers no listing tool",
        );
      }
      this.client = client;
      this.tools = new Set(tools);
      await this.verifySession();
      this.connectError = null;
      this.capabilities = {
        ...READ_ONLY_CAPABILITIES,
        read: this.has(READ_BASE64_TOOL) || this.has(READ_TOOL),
        write: this.has(WRITE_BASE64_TOOL) || this.has(WRITE_TOOL),
        delete: this.has(DELETE_TOOL),
        mkdir: this.has(MKDIR_TOOL),
        move: this.has(MOVE_TOOL),
        copy: false,
        rename: false,
        serverSideMove: false,
        serverSideCopy: false,
        quota: false,
        watch: false,
        range: false,
      };
      this.status = "connected";
    } catch (error) {
      this.status = "error";
      this.client = null;
      this.tools = new Set();
      this.connectError =
        error instanceof Error ? error : new Error(String(error));
      // Close the connection attempt, never `this.client`: this provider had no
      // working one (connect returns early otherwise).
      try {
        client.close?.();
      } catch {
        // A transport that never opened must not throw on teardown.
      }
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError("OFFLINE", explainConnect(error, this.endpoint));
    }
  }

  close() {
    try {
      this.client?.close?.();
    } catch {
      // A transport that is already gone must not throw on teardown.
    }
    this.client = null;
    this.tools = new Set();
    this.connectError = null;
  }

  /**
   * MCP reports an unhandled exception inside a tool as the bare
   * "Error executing tool <name>", so a deployment that loses the user's
   * identity, or a volume that is not writable, looked like an empty folder with
   * no explanation. One harmless call after the handshake proves the session can
   * serve this user, and its failure becomes a connect error that `back`'s
   * source row shows as the reason the drive is broken.
   */
  private async verifySession(): Promise<void> {
    if (!this.has(EXISTS_TOOL)) return;
    try {
      await this.call(EXISTS_TOOL, { path: "/" });
    } catch (error) {
      if (error instanceof WorkspaceError && error.code === "AUTH_EXPIRED") {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new WorkspaceError(
        "AUTH_EXPIRED",
        `The SAIA filesystem refused the session check (${message}). It needs the user's identity header (x-auth-claim-uid), which the SAIA deployment adds for the authenticated caller.`,
      );
    }
  }

  private async call(tool: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) {
      // The workspace keeps a provider whose connect failed so a source can be
      // retried, and then calls `list` on it. Reporting the connect failure is
      // the only diagnosis the user gets - "UNSUPPORTED list" said nothing
      // about why the handshake never succeeded.
      await this.connect().catch(() => {});
    }
    if (!this.client) {
      if (this.connectError instanceof WorkspaceError) throw this.connectError;
      throw new WorkspaceError(
        "OFFLINE",
        this.connectError
          ? explainConnect(this.connectError, this.endpoint)
          : `The SAIA filesystem is not connected (${this.endpoint})`,
      );
    }
    if (!this.has(tool)) throw new WorkspaceError("UNSUPPORTED", tool);
    try {
      const result = await this.client.callTool({ name: tool, arguments: args });
      if (result?.isError) {
        const message = textOf(result) || `${tool} failed`;
        throw new WorkspaceError(
          isAuthFailure(message) ? "AUTH_EXPIRED" : "PROVIDER_ERROR",
          message,
        );
      }
      return textOf(result);
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new WorkspaceError(
        isAuthFailure(message) ? "AUTH_EXPIRED" : "PROVIDER_ERROR",
        message,
      );
    }
  }

  /**
   * A folder that does not exist yet is empty, not an error: an older service
   * creates `<root>/<user>` only on the first write, so a new account's root can
   * be missing. Current saia-fs creates it on first contact.
   */
  private missing(path: string): DirectoryPage {
    if (path === "/") return { entries: [] };
    throw new WorkspaceError("NOT_FOUND", path);
  }

  private mtimeOf(value: unknown): string | undefined {
    const seconds = Number(value ?? 0);
    if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
    return new Date(seconds * 1000).toISOString();
  }

  private entryAt(
    directory: string,
    name: string,
    kind: "dir" | "file",
    size: unknown,
    modified: unknown,
  ): WorkspaceFileEntry {
    return {
      sourceId: this.sourceId,
      path: joinPath(directory, name),
      name,
      kind,
      size: Number.isFinite(Number(size)) ? Number(size) : undefined,
      mtime: this.mtimeOf(modified),
    };
  }

  async list(path: string, _cursor?: string): Promise<DirectoryPage> {
    const normalized = normalizePath(path);
    if (this.has(LIST_JSON_TOOL)) {
      const payload = parseJson(await this.call(LIST_JSON_TOOL, { path: normalized }));
      if (!payload) {
        throw new WorkspaceError("PROVIDER_ERROR", "The SAIA filesystem answered unreadable JSON");
      }
      if (payload.error) {
        if (String(payload.error) === "not found") return this.missing(normalized);
        throw new WorkspaceError("PROVIDER_ERROR", String(payload.error));
      }
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      return {
        entries: entries.map((entry: any) =>
          this.entryAt(
            normalized,
            String(entry?.name ?? ""),
            entry?.type === "dir" ? "dir" : "file",
            entry?.size,
            entry?.modified,
          ),
        ),
      };
    }
    const raw = await this.call(LIST_TOOL, { path: normalized });
    if (/^not found:/.test(raw)) return this.missing(normalized);
    if (/^error:/.test(raw)) {
      throw new WorkspaceError("PROVIDER_ERROR", raw.replace(/^error:\s*/, ""));
    }
    if (!raw.trim() || /: empty$/.test(raw.trim())) return { entries: [] };
    const entries: WorkspaceFileEntry[] = [];
    for (const line of raw.split("\n")) {
      const match = TEXT_ENTRY.exec(line);
      if (!match) continue;
      entries.push(
        this.entryAt(
          normalized,
          match[2],
          match[1] === "d" ? "dir" : "file",
          Number(match[3]),
          0,
        ),
      );
    }
    return { entries };
  }

  async stat(path: string): Promise<WorkspaceFileEntry> {
    const normalized = normalizePath(path);
    if (normalized === "/") {
      return { sourceId: this.sourceId, path: "/", name: "/", kind: "dir" };
    }
    if (!this.has(INFO_TOOL)) return this.statFromListing(normalized);
    const raw = await this.call(INFO_TOOL, { path: normalized });
    if (/^not found:/.test(raw)) throw new WorkspaceError("NOT_FOUND", normalized);
    if (/^error:/.test(raw)) {
      throw new WorkspaceError("PROVIDER_ERROR", raw.replace(/^error:\s*/, ""));
    }
    const match = /type=(\w+)\s+size=(\d+)\s+modified=([\d.]+)/.exec(raw);
    return {
      sourceId: this.sourceId,
      path: normalized,
      name: baseName(normalized),
      kind: match?.[1] === "dir" ? "dir" : "file",
      size: match ? Number(match[2]) : undefined,
      mtime: match ? this.mtimeOf(match[3]) : undefined,
    };
  }

  private async statFromListing(normalized: string): Promise<WorkspaceFileEntry> {
    const parent = normalizePath(
      normalized.split("/").slice(0, -1).join("/") || "/",
    );
    const page = await this.list(parent);
    const entry = page.entries.find((item) => item.name === baseName(normalized));
    if (!entry) throw new WorkspaceError("NOT_FOUND", normalized);
    return entry;
  }

  async read(path: string) {
    const normalized = normalizePath(path);
    if (this.has(READ_BASE64_TOOL)) {
      const payload = parseJson(await this.call(READ_BASE64_TOOL, { path: normalized }));
      if (!payload) {
        throw new WorkspaceError("PROVIDER_ERROR", "The SAIA filesystem answered unreadable JSON");
      }
      if (payload.error) {
        throw new WorkspaceError(
          String(payload.error) === "not found" ? "NOT_FOUND" : "PROVIDER_ERROR",
          String(payload.error),
        );
      }
      if (typeof payload.content !== "string") {
        throw new WorkspaceError("PROVIDER_ERROR", "The SAIA filesystem returned no content");
      }
      return streamOf(fromBase64(payload.content));
    }
    const raw = await this.call(READ_TOOL, { path: normalized });
    if (/^not found:/.test(raw)) throw new WorkspaceError("NOT_FOUND", normalized);
    if (/^error:/.test(raw)) {
      throw new WorkspaceError("PROVIDER_ERROR", raw.replace(/^error:\s*/, ""));
    }
    // The text tool decodes with errors="replace", so a replacement character is
    // the only trace of the bytes it already destroyed. Refuse instead of serving
    // a mangled image.
    if (raw.includes("\uFFFD")) {
      throw new WorkspaceError(
        "UNSUPPORTED",
        "This saia-fs instance cannot read binary files",
      );
    }
    return streamOf(new TextEncoder().encode(raw));
  }

  private async exists(path: string): Promise<boolean> {
    if (!this.has(EXISTS_TOOL)) return false;
    const raw = await this.call(EXISTS_TOOL, { path: normalizePath(path) });
    return raw.trim().toLowerCase() === "yes";
  }

  async write(
    path: string,
    data: ReadableStream<Uint8Array>,
    opts: { size?: number; overwrite: boolean },
  ): Promise<WorkspaceFileEntry> {
    const normalized = normalizePath(path);
    const bytes = await readAll(data);
    if (!opts.overwrite && (await this.exists(normalized))) {
      throw new WorkspaceError("CONFLICT", normalized);
    }
    if (this.has(WRITE_BASE64_TOOL)) {
      const payload = parseJson(
        await this.call(WRITE_BASE64_TOOL, {
          path: normalized,
          content: toBase64(bytes),
        }),
      );
      if (!payload) {
        throw new WorkspaceError("PROVIDER_ERROR", "The SAIA filesystem answered unreadable JSON");
      }
      if (payload.error) {
        throw new WorkspaceError("PROVIDER_ERROR", String(payload.error));
      }
      return this.stat(normalized);
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new WorkspaceError(
        "UNSUPPORTED",
        "This saia-fs instance cannot write binary files",
      );
    }
    const raw = await this.call(WRITE_TOOL, { path: normalized, content: text });
    if (/^error:/.test(raw)) {
      throw new WorkspaceError("PROVIDER_ERROR", raw.replace(/^error:\s*/, ""));
    }
    return this.stat(normalized);
  }

  async mkdir(path: string) {
    const normalized = normalizePath(path);
    const raw = await this.call(MKDIR_TOOL, { path: normalized });
    if (/^error:/.test(raw)) {
      throw new WorkspaceError("PROVIDER_ERROR", raw.replace(/^error:\s*/, ""));
    }
  }

  async remove(path: string, _opts: { recursive: boolean }) {
    const normalized = normalizePath(path);
    const raw = await this.call(DELETE_TOOL, { path: normalized });
    if (/^not found:/.test(raw)) throw new WorkspaceError("NOT_FOUND", normalized);
    if (/^error:/.test(raw)) {
      throw new WorkspaceError("PROVIDER_ERROR", raw.replace(/^error:\s*/, ""));
    }
  }

  async move(from: string, to: string) {
    const source = normalizePath(from);
    const target = normalizePath(to);
    const raw = await this.call(MOVE_TOOL, { src: source, dst: target });
    if (/^not found:/.test(raw)) throw new WorkspaceError("NOT_FOUND", source);
    if (/^error:/.test(raw)) {
      throw new WorkspaceError("PROVIDER_ERROR", raw.replace(/^error:\s*/, ""));
    }
  }

  async quota(): Promise<QuotaInfo | null> {
    return null;
  }
}
