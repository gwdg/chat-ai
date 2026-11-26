// Read-only chat tools for one shared Arcana collection.
//
// A conversation can be linked to a collection (`settings.arcana_share`), and
// then the model gets three tools that search and read it through the saia-rag
// MCP service. They are deliberately narrow: the collection is fixed by the
// link, so a prompt cannot point them at another collection, and every call is
// still authorised by the service's ACL. Nothing here writes.
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
import { isTextFileName } from "../workspace/providers/saiaRag";
import { formatBytes } from "../utils/formatBytes";
import type { ArcanaShareRef } from "../utils/arcanaShareLink";

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
  /** Close the MCP client; safe to call more than once. */
  close: () => void;
}

/**
 * The three read tools for `ref`, or an empty set when the service cannot be
 * reached. A failure is reported by the tool itself, so the turn continues.
 */
export function createArcanaChatTools(ref: ArcanaShareRef): ArcanaChatTools {
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

  const tools = [
    tool(
      "search_arcana",
      `Search the shared Arcana collection "${ref.name}" and return the most relevant text passages with their source file and score. Use this for questions about the collection's content.`,
      Type.Object({
        query: Type.String({ description: "What to look for" }),
        count: Type.Optional(
          Type.Integer({
            minimum: 1,
            maximum: MAX_SEARCH_COUNT,
            description: `Number of passages, 1-${MAX_SEARCH_COUNT}, default ${DEFAULT_SEARCH_COUNT}`,
          }),
        ),
      }),
      async ({ query, count }) => {
        const value = String(query ?? "").trim();
        if (!value) return text("A query is required.");
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
      `List the files stored in the shared Arcana collection "${ref.name}", with their size and indexing status. Use it to see what the collection contains before reading a file.`,
      Type.Object({}),
      async () => {
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
      `Read one text file of the shared Arcana collection "${ref.name}" in full. Use list_arcana_documents for the exact file name. For PDFs, Office documents and images use search_arcana instead, because their stored bytes are not text.`,
      Type.Object({
        filename: Type.String({
          description: "A file name from list_arcana_documents",
        }),
      }),
      async ({ filename }) => {
        const name = String(filename ?? "").trim();
        if (!name) return text("A file name is required.");
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
  ];

  return { tools, close: reset };
}
