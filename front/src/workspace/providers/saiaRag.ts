import type {
  WorkspaceCapabilities,
  WorkspaceFileEntry,
} from "../../db/dbTypes";
import {
  closeQuietly,
  openSaiaRagClient,
  readToolResult,
  saiaRagMcpUrl,
} from "../../apis/saiaRag";
import { mimeForName } from "../../utils/mime";
import { defaultCapabilities } from "../capabilities";
import {
  arrayParts,
  concatBytes,
  fromBase64,
  readAll,
  streamOf,
  streamParts,
  toBase64,
} from "../bytes";
import { normalizePath } from "../paths";
import { isStaleMcpSessionError } from "./mcpSession";
import type { DirectoryPage, FileProvider, ProviderEntry } from "./types";
import { WorkspaceError } from "./types";

/**
 * saia-rag, the SAIA document collections service, as a workspace source.
 *
 * The shape mirrors the service: `/` lists collections, `/<collection>` lists
 * its files and collections are flat (a file has no folder of its own). A
 * collection is live, so a workspace mounts one instead of copying it.
 *
 * Roles come from the service (`list_collections` reports the caller's role per
 * collection): a reader-only collection is marked `readOnly`, which the tree
 * and the workspace browser show as a lock and the transfer planner refuses to
 * write into. The service enforces the same rule server-side, so a UI bug
 * cannot grant a role the caller does not have.
 *
 * File bytes go through `read_file_base64` and a chunked upload: the MCP server
 * rejects one request body above 4 MiB with `413 Request body too large`, so
 * `write()` sends 1 MiB chunks to `upload_file_chunk` and only falls back to
 * `upload_file_base64` when an older service does not offer it. Text files
 * uploaded this way are stored but not indexed, so search still uses the
 * service's own text upload where it applies. Collections
 * are created and deleted with the service's own tools, never as folders here:
 * `mkdir`/`rename`/`move`/`copy` are unsupported on purpose, because a flat
 * collection has no folder tree and the UI must not offer actions that would
 * silently do nothing.
 */
const LIST_COLLECTIONS_TOOL = "list_collections";
const LIST_FILES_TOOL = "list_files";
const READ_BASE64_TOOL = "read_file_base64";
const WRITE_BASE64_TOOL = "upload_file_base64";
const WRITE_CHUNK_TOOL = "upload_file_chunk";
const UPLOAD_TEXT_TOOL = "upload_file";
const CREATE_COLLECTION_TOOL = "create_collection";
const DELETE_COLLECTION_TOOL = "delete_collection";
const REMOVE_FILE_TOOL = "remove_file";
const INDEX_COLLECTION_TOOL = "index_collection";
const LIST_MEMBERS_TOOL = "list_members";
const ADD_MEMBER_TOOL = "add_member";
const REMOVE_MEMBER_TOOL = "remove_member";
const LIST_TAGS_TOOL = "list_tags";
const GET_FILE_TAGS_TOOL = "get_file_tags";
const TAG_FILE_TOOL = "tag_file";
const SET_FILE_TAGS_TOOL = "set_file_tags";
const SEARCH_CHUNKS_TOOL = "search_chunks";
const SEARCH_DOCUMENTS_TOOL = "search_documents";
const SEARCH_PREVIEW_TOOL = "search_preview";

/**
 * Raw bytes per chunk. Base64 and the JSON envelope make this ~1.4 MiB on the
 * wire, below the service's 4 MiB request-body limit even with headers.
 */
const CHUNK_BYTES = 1024 * 1024;

const REQUIRED_TOOLS = [
  LIST_COLLECTIONS_TOOL,
  LIST_FILES_TOOL,
  READ_BASE64_TOOL,
  WRITE_BASE64_TOOL,
];

export type RagCollection = {
  name: string;
  /** The storage name `<owner>__<name>`; this is what the tools take. */
  collection: string;
  owner: string;
  role: "owner" | "editor" | "reader" | string;
  can_write: boolean;
  can_manage: boolean;
  shared: boolean;
};

export type RagMember = {
  user: string;
  role: "owner" | "editor" | "reader" | string;
  kind: "user" | "group" | string;
};

export type RagMemberRole = "reader" | "editor";
export type RagPrincipalKind = "user" | "group";

/** One stored file, as `list_files` reports it. */
export type RagFile = {
  name: string;
  size?: number;
  /** `stored` (not indexed), `indexed`, or `Failed: …` from the service. */
  status: string;
  chunks: number;
  tags: string[];
};

/** One tag of a collection and how many files carry it. */
export type RagTag = {
  name: string;
  count: number;
};

export type RagSearchMode = "chunks" | "documents" | "previews";

/** One search hit, or the service's own formatted text when it cannot be split. */
export type RagSearchResult = {
  filename: string;
  score?: number;
  text: string;
};

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "rst", "org", "ref", "csv", "tsv", "json",
  "jsonl", "yaml", "yml", "xml", "html", "htm", "tex", "log", "py",
  "js", "jsx", "ts", "tsx", "css", "java", "c", "cpp", "h", "hpp",
  "go", "rs", "sh", "sql",
]);

/**
 * Whether a file name looks like UTF-8 text.
 *
 * Only used to choose `upload_file` (which indexes on the way in) for a service
 * that does not offer `index_collection`; the current service stores every file
 * through the binary path and then indexes the text ones itself.
 */
export const isTextFileName = (name: string): boolean => {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return false;
  return TEXT_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
};

/**
 * The path segment a collection is addressed by. A caller's own collection uses
 * its name; a shared one is qualified with its owner, so two people's `papers`
 * do not collide. `list_collections` is the source of this mapping, which is
 * why the provider keeps its result around: an own collection whose name itself
 * contains `__` cannot be told apart from a qualified reference otherwise.
 */
export const ragCollectionDisplayName = (collection: RagCollection): string =>
  collection.shared ? `${collection.owner}__${collection.name}` : collection.name;

const parseJson = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const isAuthFailure = (message: string): boolean =>
  /no user identified|invalid user name|identityerror|401|unauthori[sz]ed|forbidden/i.test(
    message,
  );

const isNotFound = (message: string): boolean =>
  /not in this collection|not found|does not exist|no such/i.test(message);

const explainConnect = (error: unknown, endpoint: string): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (isAuthFailure(message)) {
    return `SAIA rejected the request for this user (${message})`;
  }
  return `${message} (${endpoint})`;
};

const collectionOf = (value: any): RagCollection | null => {
  if (!value || typeof value !== "object") return null;
  const name = String(value.name ?? "").trim();
  const collection = String(value.collection ?? "").trim();
  if (!name || !collection) return null;
  return {
    name,
    collection,
    owner: String(value.owner ?? collection.split("__")[0] ?? ""),
    role: String(value.role ?? "reader"),
    can_write: value.can_write === true,
    can_manage: value.can_manage === true,
    shared: value.shared === true,
  };
};

const page = (entries: ProviderEntry[], cursor?: string): DirectoryPage => {
  const start = cursor ? Number(cursor) : 0;
  const slice = entries.slice(start, start + 200);
  return {
    entries: slice,
    next:
      start + slice.length < entries.length
        ? String(start + slice.length)
        : undefined,
  };
};

/**
 * `list_tags` and `get_file_tags` answer human-formatted text, not JSON: each
 * tag is `name (count)` and a file's tags are comma-separated. Parsing them
 * here keeps that quirk out of the UI.
 */
const parseTagList = (text: string): RagTag[] => {
  const rows: RagTag[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^(.*?)\s+\((\d+)\)\s*$/);
    if (match) rows.push({ name: match[1].trim(), count: Number(match[2]) });
  }
  return rows;
};

const parseFileTags = (text: string): string[] => {
  if (!text || /no tags/i.test(text)) return [];
  return text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

/**
 * The search tools render their hits as text. `search_preview` and
 * `search_chunks` can be split back into one result per hit; `search_documents`
 * is only a numbered list, so a line is one result with no snippet.
 */
export const parseSearchResults = (
  text: string,
  mode: RagSearchMode,
): RagSearchResult[] => {
  if (!text || /no (matching|results)/i.test(text)) return [];
  if (mode === "chunks") {
    return text
      .split(/\n{2,}(?=\[)/)
      .map((block) => {
        const match = block.match(/^\[(.*?) score=([\d.]+)\]\s*\n?([\s\S]*)$/);
        if (!match) return { filename: "", text: block.trim() };
        return {
          filename: match[1],
          score: Number(match[2]),
          text: match[3].trim(),
        };
      })
      .filter((result) => result.text);
  }
  const results: RagSearchResult[] = [];
  const blocks = mode === "previews" ? text.split(/\n{2,}(?=\d+\. )/) : text.split("\n");
  for (const block of blocks) {
    const head = block.split("\n")[0] ?? "";
    const match = head.match(/^\d+\.\s+(.*?)\s+\(score=([\d.]+)/);
    if (!match) continue;
    const rest = block.slice(head.length).replace(/^\n/, "").trim();
    results.push({
      filename: match[1],
      score: Number(match[2]),
      text: rest,
    });
  }
  return results;
};

export class SaiaRagProvider implements FileProvider {
  readonly kind = "saia-rag" as const;
  capabilities: WorkspaceCapabilities = defaultCapabilities("saia-rag");
  status: "connected" | "needs-permission" | "offline" | "error" = "offline";

  private client: any = null;
  private tools = new Set<string>();
  private connectPromise: Promise<void> | null = null;
  private connectError: Error | null = null;
  /** display path segment -> collection, refreshed by `listCollections`. */
  private collections = new Map<string, RagCollection>();

  constructor(
    readonly sourceId: string,
    readonly endpoint: string = saiaRagMcpUrl(),
  ) {}

  private has(tool: string): boolean {
    return this.tools.has(tool);
  }

  /** Idempotent: concurrent callers share one handshake. */
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
    let client: any = null;
    try {
      client = await openSaiaRagClient();
      const tools: string[] = [];
      let cursor: string | undefined;
      do {
        const listing = await client.listTools(cursor ? { cursor } : undefined);
        for (const tool of listing.tools ?? []) tools.push(tool.name);
        cursor = listing.nextCursor;
      } while (cursor);
      const missing = REQUIRED_TOOLS.filter((tool) => !tools.includes(tool));
      if (missing.length > 0) {
        throw new WorkspaceError(
          "UNSUPPORTED",
          `saia-rag does not offer ${missing.join(", ")}`,
        );
      }
      this.client = client;
      this.tools = new Set(tools);
      await this.verifySession();
      this.connectError = null;
      // A collection is not a folder and `delete` is a provider-wide capability,
      // so it stays false: enabling it would offer Delete on a collection row
      // (which cannot be removed through the tree). Per-file removal exists for
      // the Arcanas manager through `removeFile`; deleting a collection is the
      // source browser's owner-only action.
      this.capabilities = { ...defaultCapabilities("saia-rag") };
      this.status = "connected";
    } catch (error) {
      this.status = "error";
      this.client = null;
      this.tools = new Set();
      this.collections.clear();
      this.connectError =
        error instanceof Error ? error : new Error(String(error));
      closeQuietly(client);
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError("OFFLINE", explainConnect(error, this.endpoint));
    }
  }

  close() {
    closeQuietly(this.client);
    this.client = null;
    this.tools = new Set();
    this.collections.clear();
    this.connectError = null;
  }

  private async verifySession(): Promise<void> {
    try {
      await this.call(LIST_COLLECTIONS_TOOL, {});
    } catch (error) {
      if (error instanceof WorkspaceError && error.code === "AUTH_EXPIRED") {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new WorkspaceError(
        "AUTH_EXPIRED",
        `saia-rag refused the session check (${message}). It needs the user's identity header, which the SAIA deployment adds for the authenticated caller.`,
      );
    }
  }

  /** The MCP call, with the connect failure surfaced when there is no session. */
  private async rawCall(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (!this.client) {
      await this.connect();
    }
    if (!this.client) {
      throw (
        this.connectError ??
        new WorkspaceError("OFFLINE", `saia-rag is not connected (${this.endpoint})`)
      );
    }
    try {
      return await this.invoke(tool, args);
    } catch (error) {
      // saia-rag forgets the session when its process restarts or the session
      // idles out, and the SDK keeps sending the dead id; one fresh handshake
      // repairs the source instead of leaving the drive broken until a reload.
      // Inside `open()` the connect promise is pending, and a retry there would
      // wait on itself.
      if (!isStaleMcpSessionError(error) || this.connectPromise) {
        throw this.asWorkspaceError(error);
      }
      this.close();
      await this.connect();
      if (!this.has(tool)) {
        throw new WorkspaceError("UNSUPPORTED", `saia-rag does not offer ${tool}`);
      }
      try {
        return await this.invoke(tool, args);
      } catch (retryError) {
        throw this.asWorkspaceError(retryError);
      }
    }
  }

  /** One MCP call, mapping the service's tool errors onto workspace errors. */
  private async invoke(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const result = await this.client.callTool({ name: tool, arguments: args });
    const { text, isError } = readToolResult(result);
    if (isError) {
      if (isAuthFailure(text)) throw new WorkspaceError("AUTH_EXPIRED", text);
      if (isNotFound(text)) throw new WorkspaceError("NOT_FOUND", text);
      throw new WorkspaceError("PROVIDER_ERROR", text || `saia-rag ${tool} failed`);
    }
    return text;
  }

  private asWorkspaceError(error: unknown): WorkspaceError {
    if (error instanceof WorkspaceError) return error;
    const message = error instanceof Error ? error.message : String(error);
    if (isAuthFailure(message)) return new WorkspaceError("AUTH_EXPIRED", message);
    return new WorkspaceError("OFFLINE", message);
  }

  private async call(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    // The tool list arrives with the handshake, so a first call has to connect
    // before it can ask whether the service offers the tool.
    if (!this.client) await this.connect();
    if (!this.has(tool)) {
      throw new WorkspaceError(
        "UNSUPPORTED",
        `saia-rag does not offer ${tool}`,
      );
    }
    return this.rawCall(tool, args);
  }

  // ---- collections ------------------------------------------------------

  /** Every collection the caller can see, and the path segment each one uses. */
  async listCollections(): Promise<RagCollection[]> {
    const text = await this.call(LIST_COLLECTIONS_TOOL, {});
    const payload = parseJson(text);
    const rows = Array.isArray(payload?.collections)
      ? payload.collections
      : Array.isArray(payload)
        ? payload
        : [];
    const next = new Map<string, RagCollection>();
    const result: RagCollection[] = [];
    for (const row of rows) {
      const collection = collectionOf(row);
      if (!collection) continue;
      next.set(ragCollectionDisplayName(collection), collection);
      result.push(collection);
    }
    this.collections = next;
    return result;
  }

  /**
   * The collection behind a path segment, from the last `listCollections`.
   *
   * The source browser needs the role synchronously when it offers to mount the
   * collection that is open, because a mount has to carry the same read-only
   * state the rows do. `undefined` only before anything was listed.
   */
  collectionFor(display: string): RagCollection | undefined {
    return this.collections.get(display);
  }

  private async resolveCollection(display: string): Promise<RagCollection> {
    let collection = this.collections.get(display);
    if (!collection) {
      // A mount can open before the collections were listed in this session.
      await this.listCollections();
      collection = this.collections.get(display);
    }
    if (!collection) {
      throw new WorkspaceError("NOT_FOUND", `Collection not found: ${display}`);
    }
    return collection;
  }

  async createCollection(name: string): Promise<RagCollection | undefined> {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) throw new WorkspaceError("PROVIDER_ERROR", "A name is required");
    await this.call(CREATE_COLLECTION_TOOL, { collection: trimmed });
    const collections = await this.listCollections();
    return collections.find(
      (collection) =>
        !collection.shared && collection.name === trimmed,
    );
  }

  async deleteCollection(display: string): Promise<void> {
    const collection = await this.resolveCollection(display);
    if (!collection.can_manage) {
      throw new WorkspaceError(
        "PERMISSION_DENIED",
        "Only the owner can delete this collection",
      );
    }
    await this.call(DELETE_COLLECTION_TOOL, {
      collection: collection.collection,
    });
    this.collections.delete(display);
  }

  /** Does this service advertise a tool? The Arcanas UI hides what it cannot do. */
  supportsTool(tool: string): boolean {
    return this.has(tool);
  }

  // ---- files ------------------------------------------------------------

  /** Every file of a collection, optionally filtered by tags. */
  async listFiles(
    display: string,
    options: { tags?: string[]; includeTags?: boolean } = {},
  ): Promise<RagFile[]> {
    const collection = await this.resolveCollection(display);
    const args: Record<string, unknown> = {
      collection: collection.collection,
    };
    if (options.tags?.length) args.tags = options.tags;
    // `include_tags` shipped with `set_file_tags`, so its presence tells us the
    // service can answer tags in this one call. An older service gets them per
    // file below, which is slower but keeps the UI usable.
    const batched = options.includeTags !== false && this.has(SET_FILE_TAGS_TOOL);
    if (batched) args.include_tags = true;
    const text = await this.call(LIST_FILES_TOOL, args);
    const payload = parseJson(text);
    const rows = Array.isArray(payload?.files) ? payload.files : [];
    const files: RagFile[] = rows
      .map((row: any) => {
        const name = String(row?.name ?? "").trim();
        if (!name) return null;
        return {
          name,
          size: typeof row.size === "number" ? row.size : undefined,
          status: String(row.status ?? "indexed"),
          chunks: typeof row.chunks === "number" ? row.chunks : 0,
          tags: Array.isArray(row.tags)
            ? row.tags.map((tag: unknown) => String(tag)).filter(Boolean)
            : [],
        };
      })
      .filter((file: RagFile | null): file is RagFile => file !== null)
      .sort((a: RagFile, b: RagFile) => a.name.localeCompare(b.name));

    if (options.includeTags !== false && !batched && this.has(GET_FILE_TAGS_TOOL)) {
      await Promise.all(
        files.map(async (file) => {
          try {
            file.tags = await this.getFileTags(display, file.name);
          } catch {
            file.tags = [];
          }
        }),
      );
    }
    return files;
  }

  async getFileTags(display: string, filename: string): Promise<string[]> {
    const collection = await this.resolveCollection(display);
    const text = await this.call(GET_FILE_TAGS_TOOL, {
      collection: collection.collection,
      filename,
    });
    return parseFileTags(text);
  }

  async listTags(display: string): Promise<RagTag[]> {
    const collection = await this.resolveCollection(display);
    const text = await this.call(LIST_TAGS_TOOL, {
      collection: collection.collection,
    });
    return parseTagList(text);
  }

  /**
   * Replace a file's tags. A service without `set_file_tags` can only add, so
   * the caller is told which mode it got and hides the remove buttons.
   */
  async setFileTags(
    display: string,
    filename: string,
    tags: string[],
  ): Promise<string[]> {
    const collection = await this.resolveCollection(display);
    if (this.has(SET_FILE_TAGS_TOOL)) {
      const text = await this.call(SET_FILE_TAGS_TOOL, {
        collection: collection.collection,
        filename,
        tags,
      });
      const payload = parseJson(text);
      return Array.isArray(payload?.tags)
        ? payload.tags.map((tag: unknown) => String(tag)).filter(Boolean)
        : tags;
    }
    const added = await this.call(TAG_FILE_TOOL, {
      collection: collection.collection,
      filename,
      tags,
    });
    const match = added.match(/:\s*(.*)$/);
    return match ? parseFileTags(match[1]) : tags;
  }

  async removeFile(display: string, filename: string): Promise<void> {
    const collection = await this.resolveCollection(display);
    await this.call(REMOVE_FILE_TOOL, {
      collection: collection.collection,
      filename,
    });
  }

  /**
   * Store one file through `upload_file_chunk`, then let the caller index the
   * collection. Binary files are stored exactly as they arrived.
   */
  async uploadFile(display: string, file: File): Promise<void> {
    const collection = await this.resolveCollection(display);
    if (!collection.can_write) {
      throw new WorkspaceError(
        "PERMISSION_DENIED",
        "You have read-only access to this collection",
      );
    }
    await this.write(
      `/${display}/${file.name}`,
      file.stream() as ReadableStream<Uint8Array>,
      { size: file.size, overwrite: true },
    );
  }

  /**
   * The text upload path of an older service: it indexes the file as it stores
   * it, which is the only indexing an older service offers.
   */
  async uploadTextFile(
    display: string,
    filename: string,
    content: string,
  ): Promise<void> {
    const collection = await this.resolveCollection(display);
    await this.call(UPLOAD_TEXT_TOOL, {
      collection: collection.collection,
      filename,
      content,
    });
  }

  /** Start indexing every stored text file. Returns the service's job id. */
  async indexCollection(display: string): Promise<string> {
    const collection = await this.resolveCollection(display);
    const text = await this.call(INDEX_COLLECTION_TOOL, {
      collection: collection.collection,
    });
    const payload = parseJson(text);
    return String(payload?.job_id ?? "");
  }

  // ---- search -----------------------------------------------------------

  async search(
    display: string,
    query: string,
    mode: RagSearchMode = "previews",
    count = 5,
    tags: string[] = [],
  ): Promise<{ results: RagSearchResult[]; raw: string }> {
    const collection = await this.resolveCollection(display);
    const tool =
      mode === "chunks"
        ? SEARCH_CHUNKS_TOOL
        : mode === "documents"
          ? SEARCH_DOCUMENTS_TOOL
          : SEARCH_PREVIEW_TOOL;
    const args: Record<string, unknown> = {
      collection: collection.collection,
      query,
      count,
    };
    if (tags.length) args.tags = tags;
    const text = await this.call(tool, args);
    return { results: parseSearchResults(text, mode), raw: text };
  }

  // ---- members ----------------------------------------------------------

  async listMembers(display: string): Promise<RagMember[]> {
    const collection = await this.resolveCollection(display);
    const text = await this.call(LIST_MEMBERS_TOOL, {
      collection: collection.collection,
    });
    const payload = parseJson(text);
    const rows = Array.isArray(payload?.members) ? payload.members : [];
    return rows
      .map((row: any) => ({
        user: String(row?.user ?? "").trim(),
        role: String(row?.role ?? "reader"),
        kind: String(row?.kind ?? "user"),
      }))
      .filter((row: RagMember) => row.user);
  }

  async addMember(
    display: string,
    principal: string,
    role: RagMemberRole = "editor",
    kind: RagPrincipalKind = "user",
  ): Promise<void> {
    const collection = await this.resolveCollection(display);
    if (!collection.can_manage) {
      throw new WorkspaceError(
        "PERMISSION_DENIED",
        "Only the owner can share this collection",
      );
    }
    const name = String(principal ?? "").trim();
    if (!name) throw new WorkspaceError("PROVIDER_ERROR", "A name is required");
    await this.call(ADD_MEMBER_TOOL, {
      collection: collection.collection,
      principal: name,
      role,
      kind,
    });
  }

  async removeMember(display: string, principal: string): Promise<void> {
    const collection = await this.resolveCollection(display);
    if (!collection.can_manage) {
      throw new WorkspaceError(
        "PERMISSION_DENIED",
        "Only the owner can change who shares this collection",
      );
    }
    await this.call(REMOVE_MEMBER_TOOL, {
      collection: collection.collection,
      principal: String(principal ?? "").trim(),
    });
  }

  // ---- FileProvider -----------------------------------------------------

  private parts(path: string): string[] {
    return normalizePath(path).split("/").filter(Boolean);
  }

  async list(path: string, cursor?: string): Promise<DirectoryPage> {
    const parts = this.parts(path);
    if (parts.length === 0) {
      const collections = await this.listCollections();
      return page(
        collections.map((collection) => ({
          sourceId: this.sourceId,
          path: `/${ragCollectionDisplayName(collection)}`,
          name: ragCollectionDisplayName(collection),
          kind: "dir" as const,
          readOnly: !collection.can_write,
        })),
        cursor,
      );
    }
    if (parts.length !== 1) {
      throw new WorkspaceError("UNSUPPORTED", "saia-rag collections are flat");
    }
    const collection = await this.resolveCollection(parts[0]);
    const display = ragCollectionDisplayName(collection);
    const files = await this.listFiles(display, { includeTags: false });
    return page(
      files.map((file) => ({
        sourceId: this.sourceId,
        path: `/${display}/${file.name}`,
        name: file.name,
        kind: "file" as const,
        size: file.size,
        // The collection lists names only; without a type a PDF would be handed
        // to the browser as `application/octet-stream` and downloaded.
        mime: mimeForName(file.name),
        readOnly: !collection.can_write,
      })),
      cursor,
    );
  }

  async stat(path: string): Promise<WorkspaceFileEntry> {
    const parts = this.parts(path);
    if (parts.length === 0) {
      return { sourceId: this.sourceId, path: "/", name: "/", kind: "dir" };
    }
    if (parts.length === 1) {
      const collection = await this.resolveCollection(parts[0]);
      return {
        sourceId: this.sourceId,
        path: `/${ragCollectionDisplayName(collection)}`,
        name: ragCollectionDisplayName(collection),
        kind: "dir",
        readOnly: !collection.can_write,
      };
    }
    if (parts.length !== 2) {
      throw new WorkspaceError("UNSUPPORTED", "saia-rag collections are flat");
    }
    const [display, name] = parts;
    const collection = await this.resolveCollection(display);
    const text = await this.call(LIST_FILES_TOOL, {
      collection: collection.collection,
    });
    const payload = parseJson(text);
    const files = Array.isArray(payload?.files) ? payload.files : [];
    const file = files.find((entry: any) => String(entry?.name ?? "") === name);
    if (!file) throw new WorkspaceError("NOT_FOUND", normalizePath(path));
    return {
      sourceId: this.sourceId,
      path: `/${display}/${name}`,
      name,
      kind: "file",
      size: typeof file.size === "number" ? file.size : undefined,
      // The collection lists names only; without a type a PDF would be handed to
      // the browser as `application/octet-stream` and downloaded.
      mime: mimeForName(name),
      readOnly: !collection.can_write,
    };
  }

  async read(path: string, range?: { start: number; end: number }) {
    const parts = this.parts(path);
    if (parts.length !== 2) {
      throw new WorkspaceError("UNSUPPORTED", "Not a saia-rag file");
    }
    const [display, name] = parts;
    const collection = await this.resolveCollection(display);
    const text = await this.call(READ_BASE64_TOOL, {
      collection: collection.collection,
      filename: name,
    });
    const payload = parseJson(text);
    if (!payload || typeof payload.content_base64 !== "string") {
      throw new WorkspaceError(
        "PROVIDER_ERROR",
        "saia-rag answered unreadable JSON",
      );
    }
    const data = fromBase64(payload.content_base64);
    return streamOf(range ? data.slice(range.start, range.end) : data);
  }

  async write(
    path: string,
    data: ReadableStream<Uint8Array>,
    opts: { size?: number; overwrite: boolean },
  ): Promise<WorkspaceFileEntry> {
    const parts = this.parts(path);
    if (parts.length !== 2) {
      throw new WorkspaceError("UNSUPPORTED", "saia-rag collections are flat");
    }
    const [display, name] = parts;
    const collection = await this.resolveCollection(display);
    if (!collection.can_write) {
      throw new WorkspaceError(
        "PERMISSION_DENIED",
        "You have read-only access to this collection",
      );
    }
    const exists = await this.fileExists(collection, name);
    if (exists && !opts.overwrite) {
      throw new WorkspaceError("CONFLICT", normalizePath(path));
    }
    let size: number;
    if (this.has(WRITE_CHUNK_TOOL)) {
      size = await this.uploadChunked(collection, name, streamParts(data));
    } else {
      const bytes = await readAll(data);
      await this.call(WRITE_BASE64_TOOL, {
        collection: collection.collection,
        filename: name,
        content_base64: toBase64(bytes),
      });
      size = bytes.byteLength;
    }
    return {
      sourceId: this.sourceId,
      path: `/${display}/${name}`,
      name,
      kind: "file",
      size,
      mime: mimeForName(name),
      readOnly: !collection.can_write,
    };
  }

  /**
   * A whole-file store has no native append, so this reads the old bytes and
   * writes the concatenation — in chunks when the service offers them.
   */
  async append(path: string, data: Uint8Array | string): Promise<void> {
    const parts = this.parts(path);
    if (parts.length !== 2) {
      throw new WorkspaceError("UNSUPPORTED", "saia-rag collections are flat");
    }
    const [display, name] = parts;
    const collection = await this.resolveCollection(display);
    if (!collection.can_write) {
      throw new WorkspaceError(
        "PERMISSION_DENIED",
        "You have read-only access to this collection",
      );
    }
    let current = new Uint8Array();
    if (await this.fileExists(collection, name)) {
      const text = await this.call(READ_BASE64_TOOL, {
        collection: collection.collection,
        filename: name,
      });
      const payload = parseJson(text);
      if (payload && typeof payload.content_base64 === "string") {
        current = fromBase64(payload.content_base64);
      }
    }
    const addition =
      typeof data === "string" ? new TextEncoder().encode(data) : data;
    if (this.has(WRITE_CHUNK_TOOL)) {
      await this.uploadChunked(collection, name, arrayParts([current, addition]));
      return;
    }
    await this.call(WRITE_BASE64_TOOL, {
      collection: collection.collection,
      filename: name,
      content_base64: toBase64(concatBytes(current, addition)),
    });
  }

  /**
   * Store one file through `upload_file_chunk`, 1 MiB at a time.
   *
   * The queue is drained in place rather than re-concatenated per chunk, so a
   * stream that arrives as one huge buffer still costs linear work. An empty
   * final chunk finishes a size that is an exact multiple of the chunk size
   * (and creates a zero-byte file), which is why the tail is always sent.
   * Returns the number of bytes stored.
   */
  private async uploadChunked(
    collection: RagCollection,
    name: string,
    parts: AsyncIterable<Uint8Array>,
  ): Promise<number> {
    const queue: Uint8Array[] = [];
    let queued = 0;
    let offset = 0;
    const iterator = parts[Symbol.asyncIterator]();

    const fill = async (): Promise<boolean> => {
      const { done, value } = await iterator.next();
      if (value && value.length > 0) {
        queue.push(value);
        queued += value.length;
      }
      return done === true;
    };
    const take = (size: number): Uint8Array => {
      const out = new Uint8Array(size);
      let filled = 0;
      while (filled < size && queue.length > 0) {
        const head = queue[0];
        const need = size - filled;
        if (head.length <= need) {
          out.set(head, filled);
          filled += head.length;
          queued -= head.length;
          queue.shift();
        } else {
          out.set(head.subarray(0, need), filled);
          queue[0] = head.subarray(need);
          filled += need;
          queued -= need;
        }
      }
      return filled === size ? out : out.subarray(0, filled);
    };
    const send = async (chunk: Uint8Array, last: boolean): Promise<void> => {
      await this.call(WRITE_CHUNK_TOOL, {
        collection: collection.collection,
        filename: name,
        chunk_base64: toBase64(chunk),
        offset,
        last,
      });
      offset += chunk.length;
    };

    for (;;) {
      let done = false;
      while (queued < CHUNK_BYTES && !done) done = await fill();
      if (queued >= CHUNK_BYTES) {
        await send(take(CHUNK_BYTES), false);
        continue;
      }
      // Nothing left: the tail is always sent, possibly empty, so a size that
      // is an exact multiple of the chunk size (or zero) finishes too.
      await send(take(queued), true);
      return offset;
    }
  }

  private async fileExists(
    collection: RagCollection,
    name: string,
  ): Promise<boolean> {
    const text = await this.call(LIST_FILES_TOOL, {
      collection: collection.collection,
    });
    const payload = parseJson(text);
    const rows = Array.isArray(payload?.files) ? payload.files : [];
    return rows.some((file: any) => String(file?.name ?? "") === name);
  }

  async mkdir(): Promise<void> {
    throw new WorkspaceError(
      "UNSUPPORTED",
      "saia-rag collections are created from the collection list",
    );
  }

  async remove(path: string): Promise<void> {
    const parts = this.parts(path);
    if (parts.length !== 2) {
      throw new WorkspaceError(
        "UNSUPPORTED",
        "saia-rag collections are deleted from the collection list",
      );
    }
    await this.removeFile(parts[0], parts[1]);
  }
}
