// MCP servers the user adds by URL (Streamable HTTP). Each turn connects to the enabled ones,
// lists their tools and offers them to the agent; a call goes to the server as tools/call.
// The SDK is loaded only when a server is enabled.
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";

export interface McpServer {
  url: string;
  enabled: boolean;
  /** Extra request headers, e.g. Authorization. Not shared or exported. */
  headers?: Record<string, string>;
}

const isUrl = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

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
  settings?.tools?.mcp === true ? mcpServers(settings).filter((server) => server.enabled && isUrl(server.url)) : [];

/** Whether `settings.mcp_servers` holds anything: a gateway id or a server with a URL. */
export const hasMcpServerValue = (value: unknown) =>
  typeof value === "string" ? value.trim().length > 0 : Array.isArray(value) && value.some((server) => server?.url?.trim?.());

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

type Connection = { client: any; tools: any[]; prefix: string };

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
    const prefix = toName(client.getServerVersion()?.name || new URL(server.url).host);
    return { client, tools, prefix };
  } catch (error) {
    client.close().catch(() => {});
    throw error;
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

/**
 * The tools of all servers as agent tools, named `<server>__<tool>`. Connects to the servers
 * at the same time, reusing open connections. Throws McpUnavailableError for a server that
 * cannot be reached; the turn stops then.
 */
export async function connectMcpServers(servers: McpServer[], taken: Set<string>): Promise<McpTools> {
  const opened = await Promise.all(
    servers.map(async (server) => {
      try {
        return { server, connection: await connect(server) };
      } catch (error) {
        throw new McpUnavailableError(server.url, error);
      }
    }),
  );
  const names = new Set(taken);
  const tools: AgentTool<any>[] = [];
  for (const { server, connection } of opened) {
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
        execute: async (_id, args, signal) => {
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
