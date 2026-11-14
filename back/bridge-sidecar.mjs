#!/usr/bin/env node
import { randomUUID } from "crypto";
import { createInterface } from "readline";
import WebSocket from "ws";

const url = process.env.CHAT_AI_BRIDGE_URL || "";
const token = process.env.CHAT_AI_BRIDGE_TOKEN || "";
const scopes = new Set(
  String(process.env.CHAT_AI_BRIDGE_SCOPES || "workspace")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

if (!url || !token) {
  console.error("CHAT_AI_BRIDGE_URL and CHAT_AI_BRIDGE_TOKEN are required");
  process.exit(1);
}

const tools = [
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

if (scopes.has("write")) {
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

if (scopes.has("mcp")) {
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
  socket = new WebSocket(url);
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

const handle = async (message) => {
  const { id, method } = message ?? {};
  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "chat-ai-bridge-sidecar", version: "1.0.0" },
    });
  }
  if (method === "notifications/initialized") return;
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, { tools });
  if (method === "tools/call") {
    const name = String(message.params?.name ?? "");
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
