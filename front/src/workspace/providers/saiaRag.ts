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
 * `upload_file_base64` when an older service does not offer it. A current
 * service queues conversion and indexing itself once the bytes are stored, so a
 * PDF becomes searchable and gains a Markdown download without a second call; an
 * older one only stores it, which is why the manager keeps its Index button.
 * Collections are created and deleted with the service's own tools, never as
 * folders here: `mkdir`/`rename`/`move`/`copy` are unsupported on purpose,
 * because a flat collection has no folder tree and the UI must not offer actions
 * that would silently do nothing.
 */
const LIST_COLLECTIONS_TOOL = "list_collections";
const LIST_FILES_TOOL = "list_files";
const READ_BASE64_TOOL = "read_file_base64";
const WRITE_BASE64_TOOL = "upload_file_base64";
const GET_FILE_TOOL = "get_file";
const WRITE_CHUNK_TOOL = "upload_file_chunk";
const UPLOAD_TEXT_TOOL = "upload_file";
const UPDATE_TEXT_TOOL = "update_indexed_text";
const CREATE_COLLECTION_TOOL = "create_collection";
const DELETE_COLLECTION_TOOL = "delete_collection";
const REMOVE_FILE_TOOL = "remove_file";
const INDEX_COLLECTION_TOOL = "index_collection";
const LIST_MEMBERS_TOOL = "list_members";
const ADD_MEMBER_TOOL = "add_member";
const REMOVE_MEMBER_TOOL = "remove_member";
const SET_PUBLIC_READ_TOOL = "set_public_read";
const LIST_TAGS_TOOL = "list_tags";
const GET_FILE_TAGS_TOOL = "get_file_tags";
const TAG_FILE_TOOL = "tag_file";
const SET_FILE_TAGS_TOOL = "set_file_tags";
const SEARCH_CHUNKS_TOOL = "search_chunks";
const SEARCH_DOCUMENTS_TOOL = "search_documents";
const SEARCH_PREVIEW_TOOL = "search_preview";

/**
 * Raw bytes per upload chunk.
 *
 * Matches the size `saia_rag.uploads.stage_chunk` stages (1 MiB), so the normal
 * upload never sends a chunk the service refuses. Base64 and the JSON envelope
 * turn this into ~1.4 MiB on the wire, well below the 4 MiB request-body limit.
 * A deployment that caps lower still gets a smaller chunk: the refusal names
 * the size it accepts (or answers 413) and `retrySmaller` steps down.
 */
const CHUNK_BYTES = 1024 * 1024;

/**
 * The chunk size to fall back to when a deployment's proxy rejects a body far
 * below the service's own limit (`413 Request body too large`).
 */
const MIN_CHUNK_BYTES = 256 * 1024;

/**
 * How long one tool call may stay unanswered.
 *
 * That is the MCP SDK's own default, named here so the error the user sees can
 * quote it. Without this, a request the deployment never answers leaves the
 * Arcanas dialog at "Uploading 0/1" until the SDK gives up silently.
 */
const MCP_CALL_TIMEOUT_MS = 60_000;

/**
 * How long a listed collection set answers without asking the service again.
 *
 * `list_collections` is the most expensive call saia-rag has (it opens every
 * collection it can see to read the ACL), and the workspace source browser can
 * ask for it several times while the provider is still connecting. A short
 * window collapses those asks into one request. Creating or deleting a
 * collection forces a fresh read, and `close()` drops the cache.
 */
const COLLECTIONS_TTL_MS = 5_000;

/**
 * How long a listed collection set is reused by a *different* provider instance.
 *
 * The sidebar keeps one provider for the whole session, but the workspace dialog
 * builds providers while it is open and closes them when it closes. Without this
 * window, every re-open of "Manage workspace" pays another `list_collections`,
 * which is the slowest call the service has. The rows are read-only metadata, so
 * a minute of staleness costs nothing; creating or deleting a collection
 * invalidates the entry, and `refreshArcanas` reads past it on purpose.
 */
const SHARED_COLLECTIONS_TTL_MS = 60_000;

type SharedCollections = { at: number; rows: RagCollection[] };
const sharedCollections = new Map<string, SharedCollections>();

/**
 * Forget the collection lists cached across provider instances.
 *
 * Only tests need this: the cache lives for the page, and production code clears
 * it through `invalidateCollections` when it knows the list is out of date.
 */
export function resetSaiaRagCollectionCache(): void {
  sharedCollections.clear();
}

/**
 * How long saving an edited Markdown may take.
 *
 * The save rebuilds the file's chunks instead of only storing text, so a large
 * document re-embeds every passage before it answers. The service holds the
 * collection's write lock for that whole time, which is why the ordinary call
 * timeout is too short for this one.
 */
const REWRITE_TEXT_TIMEOUT_MS = 300_000;

const REQUIRED_TOOLS = [
  LIST_COLLECTIONS_TOOL,
  LIST_FILES_TOOL,
  READ_BASE64_TOOL,
  WRITE_BASE64_TOOL,
];

export type RagCollection = {
  name: string;
  /** The reference form `<owner>/<name>`; this is what the tools take. */
  collection: string;
  owner: string;
  role: "owner" | "editor" | "reader" | string;
  can_write: boolean;
  can_manage: boolean;
  shared: boolean;
  /**
   * Every signed-in user may read and search this collection. The service
   * stores the marker in the collection database and enforces it; a deployment
   * whose `list_collections` does not report it is always `false` and only the
   * member list grants access.
   */
  public: boolean;
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
  /**
   * A converted document is indexed from its Markdown while the collection
   * keeps the original upload, so `get_file` returns the Markdown and the
   * bytes stay the uploaded file.
   */
  markdown: boolean;
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
  /** The page the passage starts on; absent for a plain text file. */
  page?: number;
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
 * The download name for a converted document's Markdown.
 *
 * `Wasserwerksschulung.pdf` becomes `Wasserwerksschulung.md`: the original
 * extension described bytes that are not in the file any more.
 */
export const markdownFileName = (name: string): string => {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem}.md`;
};

/**
 * The path segment a collection is addressed by in the browser.
 *
 * The segment must stay a single path component, so it keeps the service's
 * slash-free storage spelling (`owner__name` for a shared collection) even
 * though the reference the tools take is `owner/name`. A caller's own
 * collection uses its name; a shared one is qualified with its owner, so two
 * people's `papers` do not collide. `list_collections` is the source of this
 * mapping, which is why the provider keeps its result around: an own collection
 * whose name itself contains `__` cannot be told apart from a qualified
 * reference otherwise.
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

/**
 * The MCP SDK's request timeout (`-32001`), which is what a request the
 * deployment never answers turns into. It is translated because the raw
 * "MCP error -32001: Request timed out" does not say which tool stalled or
 * that the service may simply be busy.
 */
const isCallTimeout = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /-32001|request timed out|timed out/i.test(message);
};

/**
 * A deployment proxy can cap a request body below the service's own 4 MiB and
 * answer `413 Request body too large`. Such a request never reached the tool, so
 * nothing was staged and the same offset can be retried with a smaller piece.
 */
const isBodyTooLarge = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /HTTP 413|request body too large|payload too large|entity too large/i.test(
    message,
  );
};

/**
 * The per-chunk cap the service itself enforces, read off its refusal.
 *
 * `upload_file_chunk` stages at most 1 MiB — the app's own chunk size, so the
 * normal upload is never refused — and answers a larger piece from a stricter
 * deployment with a tool error rather than a 413. That request did reach the
 * tool, and only `stage_chunk` rejected it, so the chunk is still unstaged and
 * the same offset can be retried. The message names the limit, so the retry
 * lands on it in one step instead of halving towards it. Matching the text
 * (whatever prefix the MCP layer adds) keeps the client and `uploads.py` in
 * step without either side having to know the other's constant.
 */
const refusedChunkLimit = (error: unknown): number | null => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = /send at most (\d+) bytes per chunk/i.exec(message);
  if (!match) return null;
  const limit = Number(match[1]);
  return Number.isFinite(limit) && limit > 0 ? limit : null;
};

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
  const stored = String(value.collection ?? "").trim();
  if (!name || !stored) return null;
  // `list_collections` still reports the service's storage spelling
  // (`owner__name`); the reference every tool takes is `owner/name`. Only the
  // first separator is the owner boundary, so a name may keep its own `__`.
  const collection = stored.includes("/") ? stored : stored.replace("__", "/");
  return {
    name,
    collection,
    owner: String(value.owner ?? stored.split("__")[0] ?? ""),
    role: String(value.role ?? "reader"),
    can_write: value.can_write === true,
    can_manage: value.can_manage === true,
    shared: value.shared === true,
    public: value.public === true,
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
        // `[paper.pdf p.7 score=0.512]` for a page of a converted document,
        // `[notes.md score=0.512]` for a plain text file.
        const match = block.match(
          /^\[(.*?)(?: p\.(\d+))? score=([\d.]+)\]\s*\n?([\s\S]*)$/,
        );
        if (!match) return { filename: "", text: block.trim() };
        return {
          filename: match[1],
          ...(match[2] ? { page: Number(match[2]) } : {}),
          score: Number(match[3]),
          text: match[4].trim(),
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
  /**
   * The chunk size this deployment accepts. It only ever shrinks, and it holds
   * for this provider: a body a proxy refused with a 413, or one the service's
   * own chunk cap refused, is not retried at the same size for the next file of
   * the same page's uploads.
   */
  private chunkBytes = CHUNK_BYTES;
  private connectPromise: Promise<void> | null = null;
  private connectError: Error | null = null;
  /** display path segment -> collection, refreshed by `listCollections`. */
  private collections = new Map<string, RagCollection>();
  /** Whether `collections` holds an answer, and when it arrived. */
  private collectionsLoaded = false;
  private collectionsAt = 0;
  private collectionsPromise: Promise<RagCollection[]> | null = null;
  /**
   * Bumped whenever the cached list is known to be out of date.
   *
   * A read that started before the bump must not answer or store afterwards: a
   * `list_collections` the service had already computed when a collection was
   * created answers without it, and letting that land would hide the new row.
   */
  private collectionsEpoch = 0;

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
      client = await openSaiaRagClient(this.endpoint);
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
    this.collectionsLoaded = false;
    this.collectionsAt = 0;
    // A read still in flight belongs to the session being closed.
    this.collectionsEpoch += 1;
    this.collectionsPromise = null;
    this.connectError = null;
  }

  private async verifySession(): Promise<void> {
    try {
      // This is the same call the caller would make for the drive's listing, so
      // its answer seeds the cache instead of being thrown away. It deliberately
      // bypasses the shared promise: a reconnect after a dropped session starts
      // from inside that promise, and awaiting it there would wait on itself.
      // It may, however, adopt a list another provider of this deployment just
      // read: that is what makes re-opening the dialog cheap.
      await this.fetchCollections(undefined, true);
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
    timeoutMs: number = MCP_CALL_TIMEOUT_MS,
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
      return await this.invoke(tool, args, timeoutMs);
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
        return await this.invoke(tool, args, timeoutMs);
      } catch (retryError) {
        throw this.asWorkspaceError(retryError);
      }
    }
  }

  /** One MCP call, mapping the service's tool errors onto workspace errors. */
  private async invoke(
    tool: string,
    args: Record<string, unknown>,
    timeoutMs: number = MCP_CALL_TIMEOUT_MS,
  ): Promise<string> {
    let result: any;
    try {
      result = await this.client.callTool(
        { name: tool, arguments: args },
        undefined,
        { timeout: timeoutMs },
      );
    } catch (error) {
      if (isCallTimeout(error)) {
        throw new WorkspaceError(
          "PROVIDER_ERROR",
          `saia-rag did not answer ${tool} within ${
            timeoutMs / 1000
          } s. The service may be busy (indexing holds the collection) or unreachable; try again once it is idle.`,
        );
      }
      throw error;
    }
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
    timeoutMs: number = MCP_CALL_TIMEOUT_MS,
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
    return this.rawCall(tool, args, timeoutMs);
  }

  // ---- collections ------------------------------------------------------

  /**
   * Every collection the caller can see, and the path segment each one uses.
   *
   * Concurrent asks share one request, and a result younger than
   * `COLLECTIONS_TTL_MS` answers without another round trip: the workspace
   * browser can ask while the source is still connecting, and every ask used to
   * be a fresh (and expensive) `list_collections`.
   */
  async listCollections(): Promise<RagCollection[]> {
    if (this.collectionsPromise) return this.collectionsPromise;
    if (
      this.collectionsLoaded &&
      Date.now() - this.collectionsAt < COLLECTIONS_TTL_MS
    ) {
      return [...this.collections.values()];
    }
    // The handshake's own session check reads this list, so the session has to
    // exist before the shared promise is created: otherwise `verifySession`
    // would await the promise that is waiting for it.
    if (!this.client) await this.connect();
    if (
      this.collectionsLoaded &&
      Date.now() - this.collectionsAt < COLLECTIONS_TTL_MS
    ) {
      return [...this.collections.values()];
    }
    return this.refreshCollections();
  }

  /** Drop the cached list, so the next read asks the service. */
  invalidateCollections(): void {
    this.collectionsLoaded = false;
    this.collectionsAt = 0;
    this.collectionsEpoch += 1;
    // The list is shared with every other provider of this endpoint, so an
    // explicit refresh, a create and a delete have to drop that copy too.
    sharedCollections.delete(this.endpoint);
    // Do not join a read that started before the invalidation: its answer is
    // the one this call says is out of date.
    this.collectionsPromise = null;
  }

  /** Read the collection list, ignoring the cache. Concurrent asks share one request. */
  private refreshCollections(): Promise<RagCollection[]> {
    if (!this.collectionsPromise) {
      const epoch = this.collectionsEpoch;
      const promise: Promise<RagCollection[]> = this.fetchCollections(
        epoch,
      ).finally(() => {
        // A newer read may have replaced this one in the meantime.
        if (this.collectionsPromise === promise) this.collectionsPromise = null;
      });
      this.collectionsPromise = promise;
    }
    return this.collectionsPromise;
  }

  private async fetchCollections(
    epoch: number = this.collectionsEpoch,
    allowShared = false,
  ): Promise<RagCollection[]> {
    // A list read by another provider of this deployment answers the
    // handshake's session check, so opening the dialog again does not pay the
    // service's most expensive call a second time. An explicit read does not
    // take this shortcut: it is what revalidates the rows after the instance's
    // own cache window has passed.
    const shared = sharedCollections.get(this.endpoint);
    if (
      allowShared &&
      epoch === this.collectionsEpoch &&
      shared &&
      Date.now() - shared.at < SHARED_COLLECTIONS_TTL_MS
    ) {
      this.adoptCollections(shared.rows, Date.now());
      return [...shared.rows];
    }
    const text = await this.call(LIST_COLLECTIONS_TOOL, {});
    const payload = parseJson(text);
    const rows = Array.isArray(payload?.collections)
      ? payload.collections
      : Array.isArray(payload)
        ? payload
        : [];
    const result: RagCollection[] = [];
    for (const row of rows) {
      const collection = collectionOf(row);
      if (!collection) continue;
      result.push(collection);
    }
    // A read from before an invalidation describes a list the caller already
    // knows is stale, so it answers its own caller without replacing the cache.
    if (epoch === this.collectionsEpoch) {
      const at = Date.now();
      this.adoptCollections(result, at);
      sharedCollections.set(this.endpoint, { at, rows: result });
    }
    return result;
  }

  /** Make a collection list this instance's own, without another request. */
  private adoptCollections(rows: RagCollection[], at: number): void {
    const next = new Map<string, RagCollection>();
    for (const collection of rows) {
      next.set(ragCollectionDisplayName(collection), collection);
    }
    this.collections = next;
    this.collectionsLoaded = true;
    // Deliberately "now", not the shared record's timestamp: the caller just
    // got this list, and the 5 s window stops the click that follows the
    // handshake from asking the service again for the same rows.
    this.collectionsAt = at;
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
    // A new collection has to appear in this list, so a read that started before
    // the creation is dropped and a fresh one is made.
    this.invalidateCollections();
    const collections = await this.refreshCollections();
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
    // A read in flight may still carry the deleted row.
    this.invalidateCollections();
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
          markdown: row.markdown === true,
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
   * A file's content for a download.
   *
   * A converted document is indexed from its Markdown while the collection
   * keeps the original upload, so `markdown` asks the service for the indexed
   * text and names the download `.md`. Everything else is returned as the
   * stored bytes, under its own name.
   */
  async downloadFile(
    display: string,
    file: RagFile,
  ): Promise<{ name: string; blob: Blob }> {
    const collection = await this.resolveCollection(display);
    if (file.markdown) {
      const text = await this.call(GET_FILE_TOOL, {
        collection: collection.collection,
        filename: file.name,
      });
      return {
        name: markdownFileName(file.name),
        blob: new Blob([text], { type: "text/markdown;charset=utf-8" }),
      };
    }
    const text = await this.call(READ_BASE64_TOOL, {
      collection: collection.collection,
      filename: file.name,
    });
    const payload = parseJson(text);
    if (!payload || typeof payload.content_base64 !== "string") {
      throw new WorkspaceError(
        "PROVIDER_ERROR",
        "saia-rag answered unreadable JSON",
      );
    }
    return {
      name: file.name,
      blob: new Blob([fromBase64(payload.content_base64)], {
        type: mimeForName(file.name),
      }),
    };
  }

  /**
   * The text of the page a hit came from, plus the page after it.
   *
   * `get_file` takes page ranges as `<file>@<from>-<to>` and slices on the
   * docling `[Page N]: #` markers; a text file without markers comes back whole,
   * which is why a caller only passes a page it got from a search hit.
   */
  async readDocumentExcerpt(
    display: string,
    filename: string,
    page?: number,
  ): Promise<string> {
    const collection = await this.resolveCollection(display);
    const wanted = Math.floor(Number(page));
    const range =
      Number.isFinite(wanted) && wanted >= 1
        ? `@${wanted}-${wanted + 1}`
        : "";
    const text = await this.call(GET_FILE_TOOL, {
      collection: collection.collection,
      filename: `${filename}${range}`,
    });
    return String(text ?? "");
  }

  /**
   * A file's original bytes, whatever the service indexed from it.
   *
   * `downloadFile` answers a converted document with its indexed Markdown,
   * because that is what a download wants. A page citation wants the other
   * thing: the uploaded PDF, so the preview can be opened at the page.
   */
  async readOriginalFile(
    display: string,
    file: RagFile,
  ): Promise<{ name: string; mime: string; size: number; blob: Blob }> {
    const collection = await this.resolveCollection(display);
    const text = await this.call(READ_BASE64_TOOL, {
      collection: collection.collection,
      filename: file.name,
    });
    const payload = parseJson(text);
    if (!payload || typeof payload.content_base64 !== "string") {
      throw new WorkspaceError(
        "PROVIDER_ERROR",
        "saia-rag answered unreadable JSON",
      );
    }
    const bytes = fromBase64(payload.content_base64);
    const mime = mimeForName(file.name);
    return {
      name: file.name,
      mime,
      size: bytes.byteLength,
      blob: new Blob([bytes], { type: mime }),
    };
  }

  /**
   * Store one file through `upload_file_chunk`, then let the caller index the
   * collection. Binary files are stored exactly as they arrived.
   */
  async uploadFile(
    display: string,
    file: File,
    onProgress?: (sent: number, total: number) => void,
  ): Promise<void> {
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
      { size: file.size, overwrite: true, onProgress },
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

  /**
   * Does this service let a file's indexed text be replaced in place?
   *
   * An older service only indexes what it stores, so an edit there would have
   * to be saved as another file and the original removed. The Arcanas panel
   * hides the editor instead of destroying the uploaded document.
   */
  supportsIndexedTextEdit(): boolean {
    return this.has(UPDATE_TEXT_TOOL);
  }

  /**
   * Replace the text a file's chunks point into and rebuild them.
   *
   * The stored original is kept: a converted PDF or Word file stays in the
   * collection as it was uploaded, and only the Markdown search and the preview
   * read changes. Saving a plain text file overwrites its own bytes. The
   * service does the re-embedding inside the call, which is why it gets a
   * longer timeout than every other request.
   *
   * Returns the resulting status ("Success", or "Failed: …"), which the caller
   * shows instead of claiming the reindex worked.
   */
  async rewriteIndexedText(
    display: string,
    filename: string,
    content: string,
  ): Promise<string> {
    const collection = await this.resolveCollection(display);
    if (!collection.can_write) {
      throw new WorkspaceError(
        "PERMISSION_DENIED",
        "You have read-only access to this collection",
      );
    }
    const text = await this.call(
      UPDATE_TEXT_TOOL,
      {
        collection: collection.collection,
        filename,
        content,
      },
      REWRITE_TEXT_TIMEOUT_MS,
    );
    const payload = parseJson(text);
    return String(payload?.status ?? "");
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

  /**
   * Mark a collection readable by every signed-in user, or stop that.
   *
   * The service keeps the marker in the collection database and checks it on
   * every tool call, so this is what makes a chat link usable by somebody who is
   * not in the member list. An older service does not offer the tool;
   * `supportsPublicRead()` is what the UI checks before showing the switch.
   */
  supportsPublicRead(): boolean {
    return this.has(SET_PUBLIC_READ_TOOL);
  }

  async setPublicRead(display: string, isPublic: boolean): Promise<void> {
    const collection = await this.resolveCollection(display);
    if (!collection.can_manage) {
      throw new WorkspaceError(
        "PERMISSION_DENIED",
        "Only the owner can change who can read this collection",
      );
    }
    await this.call(SET_PUBLIC_READ_TOOL, {
      collection: collection.collection,
      public: Boolean(isPublic),
    });
    // The list carries the flag, so the sidebar and the next open must not keep
    // the old value.
    this.invalidateCollections();
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
    opts: {
      size?: number;
      overwrite: boolean;
      onProgress?: (sent: number, total: number) => void;
    },
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
    // `overwrite` is the caller's decision already; checking first costs a
    // whole `list_files` round trip per file, which is the pause between the
    // click and the first progress the user sees.
    if (!opts.overwrite) {
      const exists = await this.fileExists(collection, name);
      if (exists) throw new WorkspaceError("CONFLICT", normalizePath(path));
    }
    // Zero before the first byte leaves, so the dialog shows its progress line
    // immediately instead of looking dead while the first chunk is encoded.
    opts.onProgress?.(0, opts.size ?? 0);
    let size: number;
    if (this.has(WRITE_CHUNK_TOOL)) {
      size = await this.uploadChunked(
        collection,
        name,
        streamParts(data),
        opts.size,
        opts.onProgress,
      );
    } else {
      const bytes = await readAll(data);
      await this.call(WRITE_BASE64_TOOL, {
        collection: collection.collection,
        filename: name,
        content_base64: toBase64(bytes),
      });
      size = bytes.byteLength;
      opts.onProgress?.(size, opts.size ?? size);
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
   * Store one file through `upload_file_chunk`, one chunk at a time.
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
    total?: number,
    onProgress?: (sent: number, total: number) => void,
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
      // Only after the service accepted the chunk: a progress bar that runs
      // ahead of the stored bytes hides exactly the stall it exists to show.
      onProgress?.(offset, total ?? 0);
    };
    /**
     * A rejected body stored nothing, so the bytes go back into the queue and
     * the same offset is tried again as a smaller piece. Returns false when the
     * floor is reached, which leaves the error to the caller.
     *
     * Two rejections land here: a proxy's `413` (the request never reached the
     * tool) and the service's own chunk cap (the tool ran and refused to stage
     * the piece). The second names the size it accepts, so that attempt is not
     * wasted on a ladder of halvings.
     */
    const retrySmaller = (chunk: Uint8Array, error: unknown): boolean => {
      const announced = refusedChunkLimit(error);
      if (announced === null && !isBodyTooLarge(error)) return false;
      if (this.chunkBytes <= MIN_CHUNK_BYTES) return false;
      queue.unshift(chunk);
      queued += chunk.length;
      const smaller =
        announced !== null && announced < this.chunkBytes
          ? announced
          : Math.floor(this.chunkBytes / 2);
      this.chunkBytes = Math.max(MIN_CHUNK_BYTES, smaller);
      return true;
    };

    for (;;) {
      let done = false;
      while (queued < this.chunkBytes && !done) done = await fill();
      const full = queued >= this.chunkBytes;
      const chunk = take(full ? this.chunkBytes : queued);
      try {
        await send(chunk, !full);
      } catch (error) {
        if (retrySmaller(chunk, error)) continue;
        throw error;
      }
      // A full chunk means more may follow. The tail always ends the upload,
      // even when it is empty.
      if (!full) return offset;
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
