// Read-only chat tools for the Arcana collections a conversation can read.
//
// A chat owns a list of bindings (`settings.arcana_shares`, plus the single
// `settings.arcana_share` an access link writes), and the model gets six tools:
// `list_arcanas` to see what is available and what each collection is for,
// `arcana_details` for one collection's owner and description, then
// `search_arcana`, `list_arcana_documents`, `read_arcana_document` and
// `retrieve_document`, which take a `collection` argument. The argument is
// validated against this chat's list, so a prompt cannot point a tool at a
// collection the chat was never given; every call is still authorised by the
// service's ACL. Nothing here writes.
//
// `retrieve_document` is the source card: it reads the page a passage came from
// plus the page after it, and `getDocuments()` hands the app what it captured, so
// the answer can show the excerpt and open the document at that page. The tool
// itself never returns a marker — the app writes those.
//
// The client is created lazily on the first tool call, shared by the tools of
// one turn, and closed when the turn ends. A service that forgot the MCP session
// (restart, idle timeout) is reconnected once, exactly like the workspace
// source does.
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";

import {
  closeQuietly,
  openSaiaRagClient,
  readToolResult,
} from "../apis/saiaRag";
import { fromBase64 } from "../workspace/bytes";
import { isStaleMcpSessionError } from "../workspace/providers/mcpSession";
import {
  isTextFileName,
  parseSearchResults,
} from "../workspace/providers/saiaRag";
import { formatBytes } from "../utils/formatBytes";
import { normalizeTagList } from "../utils/tags";
import {
  MAX_ARCANA_DOCUMENT_PAGES,
  arcanaDocumentKey,
  normalizeArcanaDocument,
  splitDocumentPages,
  type ArcanaDocument,
} from "../utils/arcanaDocuments";
import {
  arcanaRefId,
  parseArcanaShareRef,
  type ArcanaShareRef,
} from "../utils/arcanaShareLink";

/** One document read is capped so a large file cannot fill the context. */
const MAX_DOCUMENT_CHARS = 100_000;
const DEFAULT_SEARCH_COUNT = 5;
const MAX_SEARCH_COUNT = 20;

const text = (value: string): AgentToolResult<any> => ({
  content: [{ type: "text", text: value }],
  details: undefined,
});

const parseJson = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const clamp = (value: unknown, fallback: number, max: number): number => {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, 1), max);
};

function tool(
  name: string,
  description: string,
  parameters: any,
  execute: (args: any) => Promise<AgentToolResult<any>>,
): AgentTool<any> {
  return {
    name,
    label: name,
    description,
    parameters,
    execute: (_id, args) => execute(args ?? {}),
  };
}

export interface ArcanaChatTools {
  tools: AgentTool<any>[];
  /** Every page cited in this turn, deduplicated. */
  getDocuments: () => ArcanaDocument[];
  /** Close the MCP client; safe to call more than once. */
  close: () => void;
}

/** The label to show a model for one binding. */
const refLabel = (ref: ArcanaShareRef, descriptions?: Map<string, string>) => {
  const description = descriptions?.get(ref.collection) || ref.description;
  return description
    ? `${arcanaRefId(ref)}: ${description}`
    : `${arcanaRefId(ref)}: (no description)`;
};

const collectionList = (
  refs: ArcanaShareRef[],
  descriptions?: Map<string, string>,
) =>
  refs
    .map((ref) => `- ${refLabel(ref, descriptions)}`)
    .join("\n");

/**
 * The read tools for `refs`, or an empty set when no binding is configured.
 * A failure is reported by the tool itself, so the turn continues.
 */
export function createArcanaChatTools(refs: ArcanaShareRef[]): ArcanaChatTools {
  const byCollection = new Map(refs.map((ref) => [ref.collection, ref]));
  const only = refs.length === 1 ? refs[0] : null;

  let client: any = null;
  let connecting: Promise<any> | null = null;

  const reset = () => {
    closeQuietly(client);
    client = null;
  };

  const connect = async () => {
    if (client) return client;
    if (!connecting) {
      connecting = openSaiaRagClient()
        .then((opened) => {
          client = opened;
          return opened;
        })
        .finally(() => {
          connecting = null;
        });
    }
    return connecting;
  };

  const invoke = async (name: string, args: Record<string, unknown>) => {
    const connection = await connect();
    const result = await connection.callTool({ name, arguments: args });
    const { text: answer, isError } = readToolResult(result);
    if (isError) throw new Error(answer || `saia-rag ${name} failed`);
    return answer;
  };

  const call = async (name: string, args: Record<string, unknown>) => {
    try {
      return await invoke(name, args);
    } catch (error) {
      // The SDK keeps sending a dead `mcp-session-id`; one fresh handshake
      // repairs it. Retrying while a connect is already pending would wait on
      // itself.
      if (!isStaleMcpSessionError(error) || connecting) throw error;
      reset();
      await connect();
      return invoke(name, args);
    }
  };

  /**
   * The arguments each advertised tool takes, from one `listTools` per turn.
   *
   * Tag filtering and `include_tags` are optional parts of a tool's schema, and
   * a service older than the tag tools rejects an argument it does not know. So
   * the extra fields go out only where the schema has them; a listing that
   * fails leaves the map empty, and a requested tag filter is then reported as
   * unsupported instead of being sent and failing the whole call.
   */
  let toolArguments: Map<string, Set<string>> | null = null;
  const advertisedArguments = async (): Promise<Map<string, Set<string>>> => {
    if (toolArguments) return toolArguments;
    const rows = new Map<string, Set<string>>();
    try {
      const connection = await connect();
      if (typeof connection?.listTools === "function") {
        const listing = await connection.listTools();
        for (const entry of Array.isArray(listing?.tools) ? listing.tools : []) {
          const name = String(entry?.name ?? "").trim();
          if (!name) continue;
          const properties = entry?.inputSchema?.properties;
          rows.set(
            name,
            new Set(
              properties && typeof properties === "object"
                ? Object.keys(properties)
                : [],
            ),
          );
        }
      }
    } catch {
      // A listing failure must not stop the tool call itself.
    }
    toolArguments = rows;
    return rows;
  };

  const acceptsArgument = async (name: string, argument: string) =>
    (await advertisedArguments()).get(name)?.has(argument) === true;

  /**
   * Resolve the `collection` argument against this chat's list. Both spellings
   * are accepted, because the model sees the readable Arcana ID in
   * `list_arcanas`. With one binding the argument may be left out; with several
   * it is required, and the answer says how to choose.
   */
  const resolveRef = (value: unknown): ArcanaShareRef | null => {
    const wanted = String(value ?? "").trim();
    if (!wanted) return only;
    const direct = byCollection.get(wanted);
    if (direct) return direct;
    const parsed = parseArcanaShareRef(wanted);
    return parsed ? byCollection.get(parsed.collection) ?? null : null;
  };

  const collectionArgument = Type.Optional(
    Type.String({
      description:
        refs.length === 1
          ? `Which collection, from list_arcanas. Optional here: the only collection is "${arcanaRefId(refs[0])}".`
          : `Which collection to use, from list_arcanas (e.g. "${arcanaRefId(refs[0])}").`,
    }),
  );

  const collectionRequired = (value: unknown): ArcanaShareRef | string => {
    const ref = resolveRef(value);
    if (ref) return ref;
    if (!String(value ?? "").trim() && !only) {
      return `A collection is required. Call list_arcanas, then pass one of:\n${collectionList(refs)}`;
    }
    return `"${String(value ?? "").trim()}" is not one of this chat's Arcana collections. Call list_arcanas for the available ones.`;
  };

  /**
   * The pages this turn quotes. A citation is read-only, so it is kept as soon as
   * the tool reads it; a repeated call replaces the stored excerpt.
   */
  const documents: ArcanaDocument[] = [];
  const addDocument = (value: {
    collection: string;
    filename: string;
    page?: number;
    pages: number;
    excerpt: string;
  }): ArcanaDocument | null => {
    const document = normalizeArcanaDocument(value);
    if (!document) return null;
    const key = arcanaDocumentKey(document);
    const existing = documents.find(
      (entry) => arcanaDocumentKey(entry) === key,
    );
    if (existing) {
      Object.assign(existing, document);
      return existing;
    }
    documents.push(document);
    return document;
  };

  /**
   * The file's metadata, from one listing. `markdown` decides whether the text
   * shown to the model is the indexed Markdown (`get_file`) or the stored bytes.
   */
  const findFile = async (collection: string, name: string) => {
    const payload = parseJson(
      await call("list_files", { collection }),
    );
    const files = Array.isArray(payload?.files) ? payload.files : [];
    return (
      files.find((row: any) => String(row?.name ?? "") === name) ?? null
    );
  };

  /** The page a search hit reports for `filename`, when the service names one. */
  const bestPage = async (
    collection: string,
    filename: string,
    query: string,
  ): Promise<number | undefined> => {
    const answer = await call("search_chunks", {
      collection,
      query,
      count: MAX_SEARCH_COUNT,
    });
    return parseSearchResults(answer, "chunks").find(
      (hit) => hit.filename === filename && hit.page,
    )?.page;
  };

  const textOf = async (collection: string, filename: string) => {
    const answer = await call("read_file_base64", {
      collection,
      filename,
    });
    const payload = parseJson(answer);
    if (typeof payload?.content_base64 !== "string") return null;
    return new TextDecoder("utf-8", { fatal: false }).decode(
      fromBase64(payload.content_base64),
    );
  };

  /**
   * The rows the service reports for its collections, keyed by the readable
   * Arcana ID (`owner/name`).
   *
   * `list_collections` is the one place owner and description both come from, so
   * `list_arcanas` and `arcana_details` read the same answer: what a collection
   * is for belongs to the collection, and its owner is what the service says, not
   * what a chat happens to have stored.
   */
  const serviceCollections = async (): Promise<
    Map<string, { owner: string; description: string }>
  > => {
    const rows = new Map<string, { owner: string; description: string }>();
    try {
      const answer = await call("list_collections", {});
      const payload = parseJson(answer);
      const list = Array.isArray(payload?.collections)
        ? payload.collections
        : Array.isArray(payload)
          ? payload
          : [];
      for (const row of list) {
        const stored = String(row?.collection ?? "").trim();
        if (!stored) continue;
        // A storage name is `owner__name`; the REST shape spells the ID with a
        // slash. Splitting at the first `__` is what the service does, so a
        // collection whose own name contains `__` stays intact.
        const id = stored.includes("/") ? stored : stored.replace("__", "/");
        rows.set(id, {
          owner: String(row?.owner ?? "").trim() || stored.split("__")[0],
          description:
            typeof row?.description === "string" ? row.description.trim() : "",
        });
      }
    } catch {
      // No service, or an older one that does not report the fields: the
      // chat-local bindings still give the model something to choose by.
    }
    return rows;
  };

  /** Just the non-empty texts, for the collection lines `list_arcanas` prints. */
  const descriptionsOf = (
    rows: Map<string, { owner: string; description: string }>,
  ): Map<string, string> => {
    const descriptions = new Map<string, string>();
    for (const [id, row] of rows) {
      if (row.description) descriptions.set(id, row.description);
    }
    return descriptions;
  };

  const tools = [
    tool(
      "list_arcanas",
      "List the Arcana collections this chat can read, with a short description of each. Use it to choose the collection for search_arcana, list_arcana_documents and read_arcana_document.",
      Type.Object({}),
      async () => {
        if (!refs.length) {
          return text("This chat is not linked to an Arcana collection.");
        }
        const descriptions = descriptionsOf(await serviceCollections());
        return text(
          `Arcana collections this chat can read:\n${collectionList(refs, descriptions)}`,
        );
      },
    ),
    tool(
      "arcana_details",
      `Show the details of one of this chat's Arcana collections: who owns it and the description that says what it is for. Use list_arcanas instead when you need every collection at once.`,
      Type.Object({ collection: collectionArgument }),
      async ({ collection }) => {
        const ref = collectionRequired(collection);
        if (typeof ref === "string") return text(ref);
        const id = arcanaRefId(ref);
        const row = (await serviceCollections()).get(id);
        // The service is authoritative; the binding is all an unreachable
        // service can still answer from.
        const owner = row?.owner || ref.owner || "";
        const description = row?.description || ref.description || "";
        return text(
          [
            `Arcana: ${id}`,
            `Owner: ${owner || "(unknown)"}`,
            `Description: ${description || "(none)"}`,
          ].join("\n"),
        );
      },
    ),
    tool(
      "search_arcana",
      `Search one of this chat's Arcana collections and return the most relevant text passages with their source file and score. Use it for questions about a collection's content; call list_arcanas first when there is more than one. Pass tags to search only the files carrying all of them (list_arcana_documents shows each file's tags).`,
      Type.Object({
        query: Type.String({ description: "What to look for" }),
        collection: collectionArgument,
        tags: Type.Optional(
          Type.Array(Type.String(), {
            description:
              "Only search files carrying all of these tags. Optional; omit it to search the whole collection.",
          }),
        ),
        count: Type.Optional(
          Type.Integer({
            minimum: 1,
            maximum: MAX_SEARCH_COUNT,
            description: `Number of passages, 1-${MAX_SEARCH_COUNT}, default ${DEFAULT_SEARCH_COUNT}`,
          }),
        ),
      }),
      async ({ query, collection, count, tags }) => {
        const value = String(query ?? "").trim();
        if (!value) return text("A query is required.");
        const ref = collectionRequired(collection);
        if (typeof ref === "string") return text(ref);
        const wanted = normalizeTagList(tags);
        const args: Record<string, unknown> = {
          collection: ref.collection,
          query: value,
          count: clamp(count, DEFAULT_SEARCH_COUNT, MAX_SEARCH_COUNT),
        };
        if (wanted.length) {
          if (!(await acceptsArgument("search_chunks", "tags"))) {
            return text(
              "This Arcana service cannot filter a search by tags, so nothing was searched. Run the search again without tags and tell the user tag filtering is unavailable there.",
            );
          }
          args.tags = wanted;
        }
        const answer = await call("search_chunks", args);
        return text(answer || "No results found.");
      },
    ),
    tool(
      "list_arcana_documents",
      `List the files stored in one of this chat's Arcana collections, with their size, indexing status and tags. Use it to see what a collection contains before reading a file; call list_arcanas first when there is more than one. Pass tags to list only the files carrying all of them.`,
      Type.Object({
        collection: collectionArgument,
        tags: Type.Optional(
          Type.Array(Type.String(), {
            description:
              "Only list files carrying all of these tags. Optional; omit it to list the whole collection.",
          }),
        ),
      }),
      async ({ collection, tags }) => {
        const ref = collectionRequired(collection);
        if (typeof ref === "string") return text(ref);
        const wanted = normalizeTagList(tags);
        const args: Record<string, unknown> = { collection: ref.collection };
        if (wanted.length) {
          if (!(await acceptsArgument("list_files", "tags"))) {
            return text(
              "This Arcana service cannot filter a file list by tags, so nothing was listed. Call it again without tags and tell the user tag filtering is unavailable there.",
            );
          }
          args.tags = wanted;
        }
        // `include_tags` shipped after `list_files` itself, so only a service
        // that advertises it gets asked for the tags.
        if (await acceptsArgument("list_files", "include_tags")) {
          args.include_tags = true;
        }
        const answer = await call("list_files", args);
        const payload = parseJson(answer);
        const files = Array.isArray(payload?.files) ? payload.files : null;
        if (!files) return text(answer || "The collection has no files.");
        if (files.length === 0) {
          return text(
            wanted.length
              ? `No files in "${ref.name}" carry all of these tags: ${wanted.join(", ")}.`
              : `The collection "${ref.name}" has no files.`,
          );
        }
        const lines = files.map((file: any) => {
          const name = String(file?.name ?? "unnamed");
          const size =
            typeof file?.size === "number" ? formatBytes(file.size) : "size unknown";
          const status = String(file?.status ?? "indexed");
          const chunks =
            typeof file?.chunks === "number" && file.chunks > 0
              ? `, ${file.chunks} chunks`
              : "";
          const tagsOfFile = Array.isArray(file?.tags)
            ? file.tags.map((tag: unknown) => String(tag ?? "").trim()).filter(Boolean)
            : [];
          const tagText = tagsOfFile.length
            ? `, tags: ${tagsOfFile.join(", ")}`
            : "";
          return `- ${name} (${size}, ${status}${chunks}${tagText})`;
        });
        const scope = wanted.length ? ` tagged with ${wanted.join(", ")}` : "";
        return text(`Files in "${ref.name}"${scope}:\n${lines.join("\n")}`);
      },
    ),
    tool(
      "read_arcana_document",
      `Read one text file of one of this chat's Arcana collections in full. Use list_arcana_documents for the exact file name. For PDFs, Office documents and images use search_arcana instead, because their stored bytes are not text.`,
      Type.Object({
        filename: Type.String({
          description: "A file name from list_arcana_documents",
        }),
        collection: collectionArgument,
      }),
      async ({ filename, collection }) => {
        const name = String(filename ?? "").trim();
        if (!name) return text("A file name is required.");
        const ref = collectionRequired(collection);
        if (typeof ref === "string") return text(ref);
        if (!isTextFileName(name)) {
          return text(
            `"${name}" is not a text file, so its stored bytes cannot be shown as text. Use search_arcana to read the passages that were indexed from it.`,
          );
        }
        const answer = await call("read_file_base64", {
          collection: ref.collection,
          filename: name,
        });
        const payload = parseJson(answer);
        if (typeof payload?.content_base64 !== "string") {
          return text("saia-rag answered with unreadable content.");
        }
        const bytes = fromBase64(payload.content_base64);
        const content = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        if (content.length > MAX_DOCUMENT_CHARS) {
          return text(
            `# ${name}\n\n${content.slice(0, MAX_DOCUMENT_CHARS)}\n\n[truncated; the file is longer]`,
          );
        }
        return text(content ? `# ${name}\n\n${content}` : `# ${name}\n\n(empty file)`);
      },
    ),
    tool(
      "retrieve_document",
      `Show the page a passage came from. Returns that page and the page after it and adds a source card under your answer that opens the document at that page. Pass the p.N of a search result; without a page, pass the user's question as query and the best page of that file is used. Use it whenever you quote from a document.`,
      Type.Object({
        filename: Type.String({
          description:
            "Exact file name, from a search result or list_arcana_documents",
        }),
        page: Type.Optional(
          Type.Integer({
            minimum: 1,
            description: "Page to show, usually the p.N of a search result",
          }),
        ),
        query: Type.Optional(
          Type.String({
            description:
              "The question, used to find the best page when no page is given",
          }),
        ),
        collection: collectionArgument,
      }),
      async ({ filename, page, query, collection }) => {
        const name = String(filename ?? "").trim();
        if (!name) return text("A file name is required.");
        const ref = collectionRequired(collection);
        if (typeof ref === "string") return text(ref);
        const file = await findFile(ref.collection, name);
        if (!file) {
          return text(
            `"${name}" is not in "${ref.name}". Use list_arcana_documents for the exact file name.`,
          );
        }
        let wanted = Math.floor(Number(page));
        if (!(Number.isFinite(wanted) && wanted >= 1)) {
          const question = String(query ?? "").trim();
          wanted = question
            ? ((await bestPage(ref.collection, name, question)) ?? 1)
            : 1;
        }

        let excerpt: string | null;
        if (file.markdown === true) {
          excerpt = await call("get_file", {
            collection: ref.collection,
            filename: `${name}@${wanted}-${wanted + 1}`,
          });
        } else if (isTextFileName(name)) {
          excerpt = await textOf(ref.collection, name);
        } else {
          return text(
            `"${name}" is a binary file, so it has no text pages to quote. Use search_arcana and report the passage instead.`,
          );
        }
        if (!excerpt?.trim()) {
          return text(
            `"${name}" has no readable text on page ${wanted}. Use search_arcana to find a passage that was indexed.`,
          );
        }

        // The excerpt decides the page: a converted document always carries
        // `[Page N]: #`, a plain text file never does.
        const blocks = splitDocumentPages(excerpt).filter(
          (block) => block.page !== null,
        );
        const shownPage =
          file.markdown === true && blocks.length
            ? (blocks[0].page as number)
            : undefined;
        const shownPages = Math.min(
          blocks.length || 1,
          MAX_ARCANA_DOCUMENT_PAGES,
        );
        const document = addDocument({
          collection: ref.collection,
          filename: name,
          ...(shownPage ? { page: shownPage } : {}),
          pages: shownPages,
          excerpt,
        });
        const where = shownPage
          ? ` page ${shownPage}${
              shownPages > 1 ? `-${shownPage + shownPages - 1}` : ""
            }`
          : "";
        const body =
          excerpt.length > MAX_DOCUMENT_CHARS
            ? `${excerpt.slice(0, MAX_DOCUMENT_CHARS)}\n\n[truncated; the page is longer]`
            : excerpt;
        return text(
          `${name}${where}${
            document ? " (shown as a source card under your answer)" : ""
          }:\n\n${body}${
            shownPage ? `\n\nCite "${name}", page ${shownPage}, in your answer.` : ""
          }`,
        );
      },
    ),
  ];

  return { tools, getDocuments: () => [...documents], close: reset };
}
