#!/usr/bin/env node
import { randomUUID } from "crypto";
import { createInterface } from "readline";
import WebSocket from "ws";
import {
  RESOURCE_TEMPLATE,
  listWorkspaceResources,
  readWorkspaceResource,
} from "./bridge-resources.mjs";

const url = process.env.CHAT_AI_BRIDGE_URL || "";
const token = process.env.CHAT_AI_BRIDGE_TOKEN || "";
/**
 * The per-chat key the browser generated for this bridge session.
 *
 * The page puts it into this process's environment, and the host only accepts an agent socket
 * that presents the key its session was created with. Without one (an older app, or a session
 * created before this existed) the header is omitted and the host falls back to the token.
 */
const bridgeKey = String(process.env.CHAT_AI_BRIDGE_KEY || "").trim();
const scopes = new Set(
  String(process.env.CHAT_AI_BRIDGE_SCOPES || "workspace")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
/**
 * The single-server proxy mode.
 *
 * An MCP server that carries a header (a token or password) is never handed to OpenCode as a
 * `remote` entry, because that would copy the secret onto the agent host. Instead OpenCode
 * spawns this sidecar as a `local` MCP server for that one upstream and the browser keeps the
 * header: `tools/list` asks the browser for the upstream's tools and `tools/call` asks it to
 * run one, so the credentials stay in the page. `CHAT_AI_BRIDGE_SERVER` is the configured
 * server's id, which the browser resolves when the tool is called — editing the URL or the
 * token in the app therefore takes effect without re-registering the entry.
 */
const proxyServer = String(process.env.CHAT_AI_BRIDGE_SERVER || "").trim();
const proxyLabel =
  String(process.env.CHAT_AI_BRIDGE_SERVER_NAME || "").trim() || proxyServer;

if (!url || !token) {
  console.error("CHAT_AI_BRIDGE_URL and CHAT_AI_BRIDGE_TOKEN are required");
  process.exit(1);
}

const tools = proxyServer
  ? []
  : [
      {
        name: "workspace_list",
        description:
          "List a folder in the user's selected workspace. The browser must stay connected.",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
      {
        name: "workspace_stat",
        description: "Show whether a workspace path is a file or folder.",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
      {
        name: "workspace_read",
        description: "Read a text file from the user's workspace.",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    ];

if (!proxyServer && scopes.has("write")) {
  tools.push(
    {
      name: "workspace_write",
      description: "Write a text file in the user's workspace.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "workspace_mkdir",
      description: "Create a folder in the user's workspace.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
    {
      name: "workspace_remove",
      description: "Delete a file or folder from the user's workspace.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  );
}

if (!proxyServer && scopes.has("mcp")) {
  tools.push(
    {
      name: "mcp_list_servers",
      description: "List the user's local MCP servers.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "mcp_list_tools",
      description: "List tools exposed by one local MCP server.",
      inputSchema: {
        type: "object",
        properties: { server: { type: "string" } },
        required: ["server"],
      },
    },
    {
      name: "mcp_call",
      description: "Call a tool on a local MCP server.",
      inputSchema: {
        type: "object",
        properties: {
          server: { type: "string" },
          tool: { type: "string" },
          arguments: { type: "object" },
        },
        required: ["server", "tool"],
      },
    },
  );
}

let socket = null;
let retryTimer = null;
let stopped = false;
const pending = new Map();

const sendLine = (value) => {
  process.stdout.write(`${JSON.stringify(value)}\n`);
};

const rpcResult = (id, result) => sendLine({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) =>
  sendLine({ jsonrpc: "2.0", id, error: { code, message } });

const resolvePendingOffline = (message) => {
  for (const [requestId, entry] of pending) {
    clearTimeout(entry.timer);
    entry.resolve({ ok: false, error: message });
    pending.delete(requestId);
  }
};

const connect = () => {
  if (stopped) return;
  socket = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(bridgeKey ? { "x-bridge-key": bridgeKey } : {}),
    },
  });
  socket.on("open", () => {
    console.error("Chat AI bridge connected");
  });
  socket.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(String(data));
    } catch {
      return;
    }
    if (message?.type !== "tool_result") return;
    const entry = pending.get(message.requestId);
    if (!entry) return;
    pending.delete(message.requestId);
    clearTimeout(entry.timer);
    entry.resolve(
      message.ok
        ? { ok: true, result: message.result }
        : { ok: false, error: String(message.error ?? "Bridge tool failed") },
    );
  });
  socket.on("close", () => {
    socket = null;
    resolvePendingOffline(
      "BRIDGE_OFFLINE: the browser bridge is unavailable. Continue with other tools.",
    );
    if (!stopped) {
      retryTimer = setTimeout(connect, 3000);
    }
  });
  socket.on("error", () => {});
};

const callBridge = (name, args) =>
  new Promise((resolve) => {
    if (!socket || socket.readyState !== 1) {
      resolve({
        ok: false,
        error:
          "BRIDGE_OFFLINE: the Chat AI bridge is not connected. Continue with other tools.",
      });
      return;
    }
    const requestId = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve({
        ok: false,
        error:
          "BRIDGE_TIMEOUT: the browser did not answer. Continue with other tools.",
      });
    }, 30000);
    pending.set(requestId, { resolve, timer });
    socket.send(
      JSON.stringify({
        type: "tool_call",
        requestId,
        name,
        arguments: args ?? {},
      }),
    );
  });

const bridgeOffline = (result) =>
  !result.ok && /^BRIDGE_OFFLINE/.test(String(result.error ?? ""));

/**
 * Ask again while the browser leg is still coming up.
 *
 * OpenCode asks for the tool list as soon as it spawns this process, which can be a moment
 * before the page has its socket. Retrying briefly is what makes the first `tools/list` of a
 * freshly registered entry succeed instead of leaving the server without tools.
 */
const retryOffline = async (request, attempts = 20, delay = 250) => {
  let result = await request();
  for (let attempt = 1; attempt < attempts && bridgeOffline(result); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    result = await request();
  }
  return result;
};

/** The upstream's tools as MCP tool definitions, fetched through the browser. */
let proxyTools = [];
const proxyListTools = async () => {
  const result = await retryOffline(() =>
    callBridge("mcp_list_tools", { server: proxyServer }),
  );
  if (!result.ok) {
    console.error(`Chat AI bridge proxy (${proxyLabel}): ${result.error}`);
    return proxyTools;
  }
  const list = Array.isArray(result.result)
    ? result.result
    : Array.isArray(result.result?.tools)
      ? result.result.tools
      : [];
  proxyTools = list
    .map((tool) => ({
      name: String(tool?.name ?? ""),
      ...(tool?.title ? { title: String(tool.title) } : {}),
      ...(tool?.description ? { description: String(tool.description) } : {}),
      inputSchema:
        tool?.inputSchema && typeof tool.inputSchema === "object"
          ? tool.inputSchema
          : { type: "object", properties: {} },
    }))
    .filter((tool) => tool.name);
  return proxyTools;
};

/**
 * Run one upstream tool through the browser and hand its answer back unchanged.
 *
 * The browser returns the upstream's own MCP result (content, `isError`), so an image or a
 * structured block reaches the model exactly as it would without the proxy. An older browser
 * answer, or an error string, is wrapped as text.
 */
const proxyCallTool = async (name, args) => {
  const result = await callBridge("mcp_call", {
    server: proxyServer,
    tool: name,
    arguments: args ?? {},
  });
  if (!result.ok) {
    return {
      content: [{ type: "text", text: String(result.error ?? "MCP call failed") }],
      isError: true,
    };
  }
  const value = result.result;
  if (value && typeof value === "object" && Array.isArray(value.content)) {
    return value;
  }
  const text =
    typeof value === "string"
      ? value
      : JSON.stringify(value ?? null, null, 2);
  return { content: [{ type: "text", text }], isError: false };
};

const handle = async (message) => {
  const { id, method } = message ?? {};
  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: "2025-03-26",
      capabilities: proxyServer
        ? { tools: {} }
        : {
            tools: {},
            // Workspace files are resources, so a client can read one without a
            // tool call. No subscriptions: the browser does not push changes.
            resources: { subscribe: false, listChanged: false },
          },
      serverInfo: {
        name: proxyServer
          ? `chat-ai-bridge-proxy-${proxyLabel}`
          : "chat-ai-bridge-sidecar",
        version: "1.0.0",
      },
    });
  }
  if (method === "notifications/initialized") return;
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") {
    if (proxyServer) return rpcResult(id, { tools: await proxyListTools() });
    return rpcResult(id, { tools });
  }
  if (method === "resources/list") {
    if (proxyServer) return rpcResult(id, { resources: [] });
    return rpcResult(id, await listWorkspaceResources(callBridge));
  }
  if (method === "resources/templates/list") {
    if (proxyServer) return rpcResult(id, { resourceTemplates: [] });
    return rpcResult(id, { resourceTemplates: [RESOURCE_TEMPLATE] });
  }
  if (method === "resources/read") {
    // The proxy serves one upstream's tools; its resources are not part of the
    // contract here, and answering with an error is what the client expects.
    if (proxyServer) {
      return rpcError(id, -32602, "This MCP proxy does not serve resources.");
    }
    const answer = await readWorkspaceResource(callBridge, message.params?.uri);
    if (answer.error !== undefined) return rpcError(id, -32602, answer.error);
    return rpcResult(id, answer);
  }
  if (method === "prompts/list") {
    // No prompts are served; an empty list is the protocol's answer, and an
    // error here makes a client report a broken server.
    return rpcResult(id, { prompts: [] });
  }
  if (method === "tools/call") {
    const name = String(message.params?.name ?? "");
    if (proxyServer) {
      if (!name) return rpcError(id, -32602, "A tool name is required.");
      return rpcResult(
        id,
        await proxyCallTool(name, message.params?.arguments ?? {}),
      );
    }
    if (!tools.some((tool) => tool.name === name)) {
      return rpcError(id, -32602, `Unknown tool: ${name}`);
    }
    const result = await callBridge(name, message.params?.arguments ?? {});
    if (!result.ok) {
      return rpcResult(id, {
        content: [{ type: "text", text: result.error }],
        isError: true,
      });
    }
    const text =
      typeof result.result === "string"
        ? result.result
        : JSON.stringify(result.result ?? null, null, 2);
    return rpcResult(id, {
      content: [{ type: "text", text }],
      isError: false,
    });
  }
  return rpcError(id, -32601, `Unsupported method: ${method}`);
};

createInterface({ input: process.stdin }).on("line", (line) => {
  const text = line.trim();
  if (!text) return;
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    return;
  }
  void handle(message).catch((error) => {
    rpcError(message?.id, -32603, error?.message ?? String(error));
  });
});

const stop = () => {
  stopped = true;
  if (retryTimer) clearTimeout(retryTimer);
  resolvePendingOffline("BRIDGE_OFFLINE: sidecar stopped.");
  socket?.close();
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
connect();
