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
import { defaultCapabilities } from "../capabilities";
import { fromBase64, readAll, streamOf, toBase64 } from "../bytes";
import { normalizePath } from "../paths";
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
 * File bytes go through `read_file_base64` / `upload_file_base64`, which handle
 * images and PDFs; text files uploaded this way are stored but not indexed, so
 * search still uses the service's own text upload where it applies. Collections
 * are created and deleted with the service's own tools, never as folders here:
 * `mkdir`/`rename`/`move`/`copy` are unsupported on purpose, because a flat
 * collection has no folder tree and the UI must not offer actions that would
 * silently do nothing.
 */
const LIST_COLLECTIONS_TOOL = "list_collections";
const LIST_FILES_TOOL = "list_files";
const READ_BASE64_TOOL = "read_file_base64";
const WRITE_BASE64_TOOL = "upload_file_base64";
const CREATE_COLLECTION_TOOL = "create_collection";
const DELETE_COLLECTION_TOOL = "delete_collection";
const LIST_MEMBERS_TOOL = "list_members";
const ADD_MEMBER_TOOL = "add_member";
const REMOVE_MEMBER_TOOL = "remove_member";

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
      // A collection is not a folder and the service has no per-file
      // delete/rename/move/copy. Deleting a collection is the source browser's
      // owner-only action, never this tree's per-row Delete, so `delete` stays
      // false here even though the tool exists.
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
    let result: any;
    try {
      result = await this.client.callTool({ name: tool, arguments: args });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isAuthFailure(message)) throw new WorkspaceError("AUTH_EXPIRED", message);
      throw new WorkspaceError("OFFLINE", message);
    }
    const { text, isError } = readToolResult(result);
    if (isError) {
      if (isAuthFailure(text)) throw new WorkspaceError("AUTH_EXPIRED", text);
      if (isNotFound(text)) throw new WorkspaceError("NOT_FOUND", text);
      throw new WorkspaceError("PROVIDER_ERROR", text || `saia-rag ${tool} failed`);
    }
    return text;
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
    const text = await this.call(LIST_FILES_TOOL, {
      collection: collection.collection,
    });
    const payload = parseJson(text);
    const rows = Array.isArray(payload?.files) ? payload.files : [];
    const display = ragCollectionDisplayName(collection);
    return page(
      rows
        .map((file: any) => {
          const name = String(file?.name ?? "").trim();
          if (!name) return null;
          return {
            sourceId: this.sourceId,
            path: `/${display}/${name}`,
            name,
            kind: "file" as const,
            size: typeof file.size === "number" ? file.size : undefined,
            readOnly: !collection.can_write,
          };
        })
        .filter((entry: WorkspaceFileEntry | null): entry is WorkspaceFileEntry =>
          entry !== null,
        )
        .sort((a: WorkspaceFileEntry, b: WorkspaceFileEntry) =>
          a.name.localeCompare(b.name),
        ),
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
    const bytes = await readAll(data);
    await this.call(WRITE_BASE64_TOOL, {
      collection: collection.collection,
      filename: name,
      content_base64: toBase64(bytes),
    });
    return {
      sourceId: this.sourceId,
      path: `/${display}/${name}`,
      name,
      kind: "file",
      size: bytes.byteLength,
      readOnly: !collection.can_write,
    };
  }

  /** A whole-file store has no native append, so this reads and writes the concatenation. */
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
    const combined = new Uint8Array(current.length + addition.length);
    combined.set(current, 0);
    combined.set(addition, current.length);
    await this.call(WRITE_BASE64_TOOL, {
      collection: collection.collection,
      filename: name,
      content_base64: toBase64(combined),
    });
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

  async remove(): Promise<void> {
    throw new WorkspaceError(
      "UNSUPPORTED",
      "Files cannot be deleted from a saia-rag collection here",
    );
  }
}
