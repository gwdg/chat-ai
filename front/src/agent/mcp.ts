// MCP servers the user adds by URL (Streamable HTTP). Each turn connects to the enabled ones,
// lists their tools and offers them to the agent; a call goes to the server as tools/call.
// The SDK is loaded only when a server is enabled.
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import i18n from "../i18n";
import { requestMcpConfirmation } from "./mcpConfirmation";

export interface McpServer {
  url: string;
  enabled: boolean;
  /** The server name from the last test or connection. Shown read-only in the settings. */
  name?: string;
  /** Extra request headers, e.g. Authorization. Not shared or exported. */
  headers?: Record<string, string>;
}

/** A gateway server entry: a server id. Older conversations store it as a bare string. */
export function isRemoteMcpServer(server: unknown): server is { id: string; enabled?: boolean } {
  return (
    !!server &&
    typeof server === "object" &&
    typeof (server as { id?: unknown }).id === "string" &&
    typeof (server as { url?: unknown }).url !== "string"
  );
}

const LOCAL_HOST = /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?|0\.0\.0\.0)(?::\d+)?(?:[/?#]|$)/i;

/** A server URL with a scheme; bare hosts like `localhost:9000` default to http on this machine. */
export function normalizeMcpUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `${LOCAL_HOST.test(raw) ? "http" : "https"}://${raw}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/**
 * The servers in `settings.mcp_servers`. Older conversations hold a gateway server id
 * (a string) there; those are not URLs and are ignored.
 */
export function mcpServers(settings: any): McpServer[] {
  const value = settings?.mcp_servers;
  if (!Array.isArray(value)) return [];
  return value.filter((server) => server && typeof server === "object" && typeof server.url === "string");
}

/** The servers the agent uses this turn. */
export const activeMcpServers = (settings: any) =>
  settings?.tools?.mcp === true
    ? mcpServers(settings)
        .filter((server) => server.enabled)
        .map((server) => ({ ...server, url: normalizeMcpUrl(server.url) }))
        .filter((server) => server.url)
    : [];

/** Whether `settings.mcp_servers` holds a gateway server id. */
export const hasRemoteMcpServerValue = (value: unknown) =>
  typeof value === "string"
    ? value.trim().length > 0
    : Array.isArray(value) &&
      value.some((server) => isRemoteMcpServer(server) && server.id.trim().length > 0);

/** Whether `settings.mcp_servers` holds a server the agent connects to by URL. */
export const hasLocalMcpServerValue = (value: unknown) =>
  Array.isArray(value) &&
  value.some(
    (server) =>
      server &&
      typeof server === "object" &&
      typeof (server as { url?: unknown }).url === "string" &&
      (server as { url: string }).url.trim().length > 0,
  );

/** Whether `settings.mcp_servers` holds anything: a gateway id or a server with a URL. */
export const hasMcpServerValue = (value: unknown) =>
  hasLocalMcpServerValue(value) || hasRemoteMcpServerValue(value);

/**
 * The MCP tool has two backends: local URLs in the agent (`tools.mcp`) and gateway server ids
 * in the GWDG tools (`tools.mcp_remote`). Old conversations only have `tools.mcp`; treat that
 * as the remote switch too when remote entries are stored.
 */
export const remoteMcpEnabled = (settings: any) => {
  const flag = settings?.tools?.mcp_remote;
  if (typeof flag === "boolean") return flag;
  return settings?.tools?.mcp === true && hasRemoteMcpServerValue(settings?.mcp_servers);
};

/** The servers without their headers, for sharing and exporting. */
export const withoutHeaders = (servers: unknown) =>
  Array.isArray(servers) ? servers.map(({ headers, ...rest }) => rest) : servers;

export class McpUnavailableError extends Error {
  constructor(readonly url: string, cause: unknown) {
    super(`MCP server ${url} is not reachable: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

const MAX_NAME = 64;
const toName = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "mcp";

function toResult(result: any): AgentToolResult<any> {
  const content: AgentToolResult<any>["content"] = [];
  for (const block of result?.content ?? []) {
    if (block.type === "text") content.push({ type: "text", text: block.text });
    else if (block.type === "image") content.push({ type: "image", data: block.data, mimeType: block.mimeType });
    else if (block.type === "resource") content.push({ type: "text", text: block.resource?.text ?? `[Resource ${block.resource?.uri}]` });
    else if (block.type === "resource_link") content.push({ type: "text", text: `[Resource ${block.uri}]` });
    else content.push({ type: "text", text: `[Unsupported ${block.type} content]` });
  }
  if (!result?.content && result?.toolResult !== undefined) content.push({ type: "text", text: JSON.stringify(result.toolResult) });
  if (result?.structuredContent && !content.length) content.push({ type: "text", text: JSON.stringify(result.structuredContent) });
  if (!content.length) content.push({ type: "text", text: "(no output)" });
  // pi reports a thrown error to the model as a failed tool result
  if (result?.isError) throw new Error(content.map((part) => (part.type === "text" ? part.text : "")).join("\n"));
  return { content, details: undefined };
}

type Connection = { client: any; tools: any[]; prefix: string; name: string };

// Open connections by server (URL + headers). They are opened ahead of the first message
// (prefetchMcpServers) and kept across turns; one that fails is dropped and opened again
// on the next use, so only then does a turn wait for the connection.
const connections = new Map<string, Promise<Connection>>();
const keyOf = (server: McpServer) => JSON.stringify([server.url, server.headers ?? {}]);

function drop(key: string, connection?: Promise<Connection>) {
  const current = connections.get(key);
  if (!current || (connection && current !== connection)) return;
  connections.delete(key);
  current.then(({ client }) => client.close()).catch(() => {});
}

async function open(server: McpServer): Promise<Connection> {
  const [{ Client }, { StreamableHTTPClientTransport }] = await Promise.all([
    import("@modelcontextprotocol/sdk/client/index.js"),
    import("@modelcontextprotocol/sdk/client/streamableHttp.js"),
  ]);
  const client = new Client({ name: "chat-ai", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(server.url), {
    requestInit: server.headers ? { headers: server.headers } : undefined,
  });
  try {
    await client.connect(transport);
    const tools = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined);
      tools.push(...page.tools);
      cursor = page.nextCursor;
    } while (cursor);
    const name = client.getServerVersion()?.name || new URL(server.url).host;
    return { client, tools, prefix: toName(name), name };
  } catch (error) {
    client.close().catch(() => {});
    throw error;
  }
}

export interface McpTestResult {
  name: string;
  toolCount: number;
}

/** Connects to a server, lists its tools, and closes again. Used by the settings test button. */
export async function testMcpServer(server: McpServer): Promise<McpTestResult> {
  const url = normalizeMcpUrl(server.url);
  if (!url) throw new Error(i18n.t("settings.mcp_test_invalid_url"));
  const { client, tools, name } = await open({ ...server, url });
  try {
    return { name, toolCount: tools.length };
  } finally {
    client.close().catch(() => {});
  }
}

function connect(server: McpServer): Promise<Connection> {
  const key = keyOf(server);
  let connection = connections.get(key);
  if (!connection) {
    connection = open(server);
    connections.set(key, connection);
    const opened = connection;
    // A failed attempt is not kept: the next use tries again
    opened.catch(() => drop(key, opened));
  }
  return connection;
}

/** Opens the connections to these servers in the background and closes all others. */
export function prefetchMcpServers(servers: McpServer[]) {
  const keep = new Set(servers.map(keyOf));
  for (const key of [...connections.keys()]) if (!keep.has(key)) drop(key);
  for (const server of servers) connect(server).catch(() => {});
}

export interface McpTools {
  tools: AgentTool<any>[];
}

export interface McpConnectOptions {
  /**
   * Called when the name stored for a server differs from the name it reports on connecting.
   * Return true to connect and accept the new name; false to skip the server for this turn.
   */
  onNameMismatch?: (server: McpServer, actualName: string) => Promise<boolean>;
}

/**
 * The tools of all servers as agent tools, named `<server>__<tool>`. Connects to the servers
 * at the same time, reusing open connections. Throws McpUnavailableError for a server that
 * cannot be reached; the turn stops then.
 */
export async function connectMcpServers(
  servers: McpServer[],
  taken: Set<string>,
  options: McpConnectOptions = {},
): Promise<McpTools> {
  const opened = await Promise.all(
    servers.map(async (server) => {
      try {
        return { server, connection: await connect(server) };
      } catch (error) {
        throw new McpUnavailableError(server.url, error);
      }
    }),
  );
  const accepted: typeof opened = [];
  for (const entry of opened) {
    const { server, connection } = entry;
    if (options.onNameMismatch && server.name && server.name !== connection.name) {
      if (!(await options.onNameMismatch(server, connection.name))) {
        drop(keyOf(server));
        continue;
      }
    }
    accepted.push(entry);
  }
  const names = new Set(taken);
  const tools: AgentTool<any>[] = [];
  for (const { server, connection } of accepted) {
    const key = keyOf(server);
    const current = connections.get(key);
    for (const tool of connection.tools) {
      let name = `${connection.prefix}__${toName(tool.name)}`.slice(0, MAX_NAME);
      for (let i = 2; names.has(name); i++) name = `${name.slice(0, MAX_NAME - String(i).length - 1)}_${i}`;
      names.add(name);
      tools.push({
        name,
        label: tool.title || tool.name,
        description: `${tool.description ?? ""} (MCP server ${server.url})`.trim(),
        parameters: (tool.inputSchema ?? { type: "object", properties: {} }) as any,
        execute: async (toolCallId, args, signal) => {
          const allowed = await requestMcpConfirmation(
            {
              id: String(toolCallId),
              server: server.url,
              tool: tool.name,
              callName: name,
              args: args ?? {},
            },
            signal,
          );
          if (!allowed) {
            throw new Error(
              i18n.t("mcp_confirmation.denied", { tool: tool.name, server: server.url }),
            );
          }
          let result;
          try {
            result = await connection.client.callTool({ name: tool.name, arguments: args ?? {} }, undefined, { signal });
          } catch (error) {
            // The connection may be gone (server restarted, session expired): open a new one next time
            if (!signal?.aborted) drop(key, current);
            throw error;
          }
          return toResult(result);
        },
      });
    }
  }
  return { tools };
}
