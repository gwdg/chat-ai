// Read-only chat tools for the Arcana collections a conversation can read.
//
// A chat owns a list of bindings (`settings.arcana_shares`, plus the single
// `settings.arcana_share` an access link writes), and the model gets five tools:
// `list_arcanas` to see what is available and what each collection is for, then
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
   * The descriptions the service stores with the collections.
   *
   * The description belongs to the collection, so this is the authoritative
   * text; a chat-local description from an older build stays the fallback when
   * the service has none, or cannot answer.
   */
  const serviceDescriptions = async (): Promise<Map<string, string>> => {
    const descriptions = new Map<string, string>();
    try {
      const answer = await call("list_collections", {});
      const payload = parseJson(answer);
      const rows = Array.isArray(payload?.collections)
        ? payload.collections
        : Array.isArray(payload)
          ? payload
          : [];
      for (const row of rows) {
        const stored = String(row?.collection ?? "").trim();
        const description =
          typeof row?.description === "string" ? row.description.trim() : "";
        if (!stored || !description) continue;
        descriptions.set(
          stored.includes("/") ? stored : stored.replace("__", "/"),
          description,
        );
      }
    } catch {
      // No service, or an older one that does not report the field: the
      // chat-local descriptions still give the model something to choose by.
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
        const descriptions = await serviceDescriptions();
        return text(
          `Arcana collections this chat can read:\n${collectionList(refs, descriptions)}`,
        );
      },
    ),
    tool(
      "search_arcana",
      `Search one of this chat's Arcana collections and return the most relevant text passages with their source file and score. Use it for questions about a collection's content; call list_arcanas first when there is more than one.`,
      Type.Object({
        query: Type.String({ description: "What to look for" }),
        collection: collectionArgument,
        count: Type.Optional(
          Type.Integer({
            minimum: 1,
            maximum: MAX_SEARCH_COUNT,
            description: `Number of passages, 1-${MAX_SEARCH_COUNT}, default ${DEFAULT_SEARCH_COUNT}`,
          }),
        ),
      }),
      async ({ query, collection, count }) => {
        const value = String(query ?? "").trim();
        if (!value) return text("A query is required.");
        const ref = collectionRequired(collection);
        if (typeof ref === "string") return text(ref);
        const answer = await call("search_chunks", {
          collection: ref.collection,
          query: value,
          count: clamp(count, DEFAULT_SEARCH_COUNT, MAX_SEARCH_COUNT),
        });
        return text(answer || "No results found.");
      },
    ),
    tool(
      "list_arcana_documents",
      `List the files stored in one of this chat's Arcana collections, with their size and indexing status. Use it to see what a collection contains before reading a file; call list_arcanas first when there is more than one.`,
      Type.Object({ collection: collectionArgument }),
      async ({ collection }) => {
        const ref = collectionRequired(collection);
        if (typeof ref === "string") return text(ref);
        const answer = await call("list_files", {
          collection: ref.collection,
        });
        const payload = parseJson(answer);
        const files = Array.isArray(payload?.files) ? payload.files : null;
        if (!files) return text(answer || "The collection has no files.");
        if (files.length === 0) {
          return text(`The collection "${ref.name}" has no files.`);
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
          return `- ${name} (${size}, ${status}${chunks})`;
        });
        return text(`Files in "${ref.name}":\n${lines.join("\n")}`);
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
