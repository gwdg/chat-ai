import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import cors from "cors";
import { WebSocketServer } from "ws";
import {
  RESOURCE_TEMPLATE,
  listWorkspaceResources,
  readWorkspaceResource,
} from "./bridge-resources.mjs";

const SESSION_TTL_MS = 15 * 60 * 1000;
const MAX_SESSIONS = 32;
const MAX_AGENT_SOCKETS = 32;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const TOKEN_PREFIX = "bridge-token.";

const positiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const safeEqual = (left, right) => {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
};

export const registerBridge = ({
  app,
  server,
  publicUrl,
  secret,
  corsOrigins: configuredCorsOrigins = "",
  allowAnonymous,
}) => {
  const sessionTtlMs = positiveInt(process.env.BRIDGE_SESSION_TTL_MS, SESSION_TTL_MS);
  const maxSessions = positiveInt(process.env.BRIDGE_MAX_SESSIONS, MAX_SESSIONS);
  const sharedSecret = String(secret ?? "");
  const anonymousAllowed = allowAnonymous === true;

  if (!sharedSecret && !anonymousAllowed) {
    console.warn(
      "[bridge] No BRIDGE_SHARED_SECRET: session creation is open to any client that can reach this port, and the per-chat key the browser generates is what pairs the two legs. Set BRIDGE_SHARED_SECRET (or bridgeSharedSecret in back.json) and the same value as bridgeKey in front.json to gate creation by a deployment secret.",
    );
  } else if (anonymousAllowed) {
    console.warn(
      "[bridge] WARNING: BRIDGE_ALLOW_ANON=1 permits anonymous bridge sessions; this exposes workspace access to anyone who can reach the bridge.",
    );
  }

  // Browser/OpenCode bridge: the browser keeps one WebSocket open, OpenCode talks MCP to this
  // process, and tool calls are relayed to the browser's workspace/MCP providers.
  const bridgeSessions = new Map();
  const rateLimits = new Map();

  const bridgeBaseUrl = (req) =>
    (publicUrl || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");

  const tokenFromBearer = (req) => {
    const header = String(req.headers.authorization ?? "");
    return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  };

  const bridgeAuthorized = (req, session) =>
    !!session && safeEqual(tokenFromBearer(req), session.token);

  const touchSession = (session) => {
    session.expiresAt = Date.now() + sessionTtlMs;
  };

  const destroySession = (session) => {
    if (!session) return;
    session.socket?.close();
    for (const socket of session.agentSockets) socket.close();
    session.agentSockets.clear();
    for (const [requestId, pending] of session.pending) {
      clearTimeout(pending.timer);
      pending.resolve({
        ok: false,
        error: "BRIDGE_EXPIRED: the bridge session expired. Start the bridge again.",
      });
      session.pending.delete(requestId);
    }
    bridgeSessions.delete(session.id);
  };

  const liveSession = (id) => {
    const session = bridgeSessions.get(id);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      destroySession(session);
      return null;
    }
    return session;
  };

  const sweepExpired = () => {
    const now = Date.now();
    for (const session of bridgeSessions.values()) {
      if (session.expiresAt <= now) destroySession(session);
    }
  };

  const rateLimitFor = (req) => {
    const forwarded = String(req.headers["x-forwarded-for"] ?? "")
      .split(",")[0]
      .trim();
    const ip = forwarded || req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const recent = (rateLimits.get(ip) ?? []).filter(
      (createdAt) => now - createdAt < RATE_WINDOW_MS,
    );
    if (recent.length >= RATE_LIMIT) {
      rateLimits.set(ip, recent);
      return {
        ok: false,
        retryAfter: Math.max(
          1,
          Math.ceil((recent[0] + RATE_WINDOW_MS - now) / 1000),
        ),
      };
    }
    recent.push(now);
    rateLimits.set(ip, recent);
    return { ok: true };
  };

  const bridgeToolDefinitions = (session) => {
    const tools = [
      {
        name: "workspace_list",
        description:
          "List a folder in the user's selected workspace. Paths use the workspace root; the browser must stay connected.",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string", description: "Folder path, for example /docs" } },
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
        description:
          "Read a text file from the user's workspace. Large or binary files return metadata instead of content.",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    ];
    if (session.writable) {
      tools.push(
        {
          name: "workspace_write",
          description:
            "Write a text file in the user's workspace. The user explicitly enabled workspace writes for this agent.",
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
          description: "Delete a file or folder, including subfolders, from the user's workspace.",
          inputSchema: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
          },
        },
      );
    }
    if (session.mcp) {
      tools.push(
        {
          name: "mcp_list_servers",
          description: "List the user's local MCP servers that are bridged to this agent.",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "mcp_list_tools",
          description: "List tools exposed by one bridged local MCP server.",
          inputSchema: {
            type: "object",
            properties: {
              server: { type: "string" },
            },
            required: ["server"],
          },
        },
        {
          name: "mcp_call",
          description:
            "Call a tool on one bridged local MCP server. Use mcp_list_tools first to discover tool names and schemas.",
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
    return tools;
  };

  const callBridgeBrowser = (session, name, args) =>
    new Promise((resolve) => {
      const socket = session.socket;
      if (!socket || socket.readyState !== 1) {
        resolve({
          ok: false,
          error:
            "BRIDGE_OFFLINE: the browser is not connected. Continue with the tools available in OpenCode.",
        });
        return;
      }
      const requestId = randomUUID();
      const timer = setTimeout(() => {
        session.pending.delete(requestId);
        resolve({
          ok: false,
          error:
            "BRIDGE_TIMEOUT: the browser did not answer. Continue with other tools or retry later.",
        });
      }, 30000);
      session.pending.set(requestId, { resolve, timer });
      socket.send(
        JSON.stringify({
          type: "tool_call",
          requestId,
          name,
          arguments: args ?? {},
        }),
      );
    });

  const corsOrigins = new Set(
    String(configuredCorsOrigins || process.env.CORS_ORIGINS || "")
      .split(",")
      .map((value) => value.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );

  const corsOriginAllowed = (req) => {
    const origin = req.headers.origin;
    if (!origin) return false;
    const normalized = String(origin).replace(/\/+$/, "");
    if (corsOrigins.has(normalized)) return true;
    try {
      return new URL(normalized).host === req.headers.host;
    } catch {
      return false;
    }
  };

  app.use(
    "/bridge",
    cors((req, callback) => {
      const origin = req.headers.origin;
      callback(null, {
        origin: origin && corsOriginAllowed(req) ? origin : false,
      });
    }),
  );

  app.post("/bridge/sessions", (req, res) => {
    const limit = rateLimitFor(req);
    if (!limit.ok) {
      res.setHeader("Retry-After", String(limit.retryAfter));
      return res.status(429).json({ error: "too many bridge sessions" });
    }

    if (!anonymousAllowed && sharedSecret) {
      if (!safeEqual(String(req.headers["x-bridge-key"] ?? ""), sharedSecret)) {
        return res.status(401).json({ error: "bridge key rejected" });
      }
    }

    const workspaceId = String(req.body?.workspaceId ?? "").trim();
    if (!workspaceId) {
      return res.status(400).json({ error: "workspaceId is required" });
    }

    sweepExpired();
    if (bridgeSessions.size >= maxSessions) {
      return res.status(429).json({ error: "too many active bridge sessions" });
    }

    const id = randomUUID();
    const token = randomBytes(24).toString("base64url");
    const agentToken = randomBytes(24).toString("base64url");
    // The per-chat key the browser generated for this session (`agents/bridgeKey.js`). It is
    // kept here and required again on the agent leg, which is what pairs the sidecar OpenCode
    // spawns with the page that asked for it — even with no deployment secret configured.
    const sessionKey = String(req.body?.key ?? "").trim().slice(0, 200);
    const session = {
      id,
      token,
      agentToken,
      key: sessionKey,
      agentId: String(req.body?.agentId ?? ""),
      workspaceId,
      writable: req.body?.writable === true,
      mcp: req.body?.mcp === true,
      socket: null,
      // One socket per MCP client that attaches: the workspace sidecar and one
      // authenticated-server proxy per wrapped server. They share `pending`,
      // because every request id is unique and each answer goes back to the
      // socket that asked.
      agentSockets: new Set(),
      pending: new Map(),
      createdAt: Date.now(),
      expiresAt: Date.now() + sessionTtlMs,
    };
    bridgeSessions.set(id, session);
    const base = bridgeBaseUrl(req);
    const wsBase = base.replace(/^http/, "ws");
    res.json({
      id,
      token,
      agentToken,
      runId: id,
      wsUrl: `${wsBase}/bridge/ws?id=${id}`,
      agentWsUrl: `${wsBase}/bridge/agent?id=${id}`,
      mcpUrl: `${base}/bridge/mcp/${id}`,
      expiresAt: session.expiresAt,
    });
  });

  app.delete("/bridge/sessions/:id", (req, res) => {
    const session = liveSession(req.params.id);
    if (!bridgeAuthorized(req, session)) {
      return res.status(404).end();
    }
    destroySession(session);
    res.status(204).end();
  });

  app.post("/bridge/mcp/:id", async (req, res) => {
    const session = liveSession(req.params.id);
    if (!bridgeAuthorized(req, session)) {
      return res.status(401).json({ error: "bridge token rejected" });
    }
    touchSession(session);
    const rpc = req.body ?? {};
    const id = rpc.id;
    const method = rpc.method;
    const respond = (result) => res.json({ jsonrpc: "2.0", id, result });
    const fail = (code, message) =>
      res.status(200).json({ jsonrpc: "2.0", id, error: { code, message } });

    const browserCall = (name, args) =>
      callBridgeBrowser(session, name, args);

    if (method === "initialize") {
      return respond({
        protocolVersion: "2025-03-26",
        capabilities: {
          tools: {},
          // Workspace files are resources, so a client can read one without a
          // tool call. No subscriptions: the browser does not push changes.
          resources: { subscribe: false, listChanged: false },
        },
        serverInfo: { name: "chat-ai-bridge", version: "1.0.0" },
      });
    }
    if (method === "notifications/initialized") {
      return res.status(202).end();
    }
    if (method === "ping") {
      return respond({});
    }
    if (method === "tools/list") {
      return respond({ tools: bridgeToolDefinitions(session) });
    }
    if (method === "resources/list") {
      return respond(await listWorkspaceResources(browserCall));
    }
    if (method === "resources/templates/list") {
      return respond({ resourceTemplates: [RESOURCE_TEMPLATE] });
    }
    if (method === "resources/read") {
      const answer = await readWorkspaceResource(browserCall, rpc.params?.uri);
      if (answer.error !== undefined) return fail(-32602, answer.error);
      return respond(answer);
    }
    if (method === "prompts/list") {
      // No prompts are served; an empty list is the protocol's answer, and an
      // error here makes a client report a broken server.
      return respond({ prompts: [] });
    }
    if (method === "tools/call") {
      const name = String(rpc.params?.name ?? "");
      const args = rpc.params?.arguments ?? {};
      const definitions = bridgeToolDefinitions(session);
      if (!definitions.some((tool) => tool.name === name)) {
        return fail(-32602, `Unknown tool: ${name}`);
      }
      const result = await callBridgeBrowser(session, name, args);
      if (!result.ok) {
        return respond({
          content: [{ type: "text", text: result.error }],
          isError: true,
        });
      }
      const text =
        typeof result.result === "string"
          ? result.result
          : JSON.stringify(result.result ?? null, 2);
      return respond({ content: [{ type: "text", text }], isError: false });
    }
    return fail(-32601, `Unsupported method: ${method}`);
  });

  const bridgeWss = new WebSocketServer({
    noServer: true,
    handleProtocols: () => "bridge.v1",
  });

  const browserToken = (request) => {
    const protocols = String(request.headers["sec-websocket-protocol"] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!protocols.includes("bridge.v1")) return "";
    const tokenProtocol = protocols.find((value) => value.startsWith(TOKEN_PREFIX));
    return tokenProtocol ? tokenProtocol.slice(TOKEN_PREFIX.length) : "";
  };

  const rejectUpgrade = (socket) => {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
  };

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(
      request.url,
      `http://${request.headers.host || "localhost"}`,
    );
    if (url.pathname !== "/bridge/ws" && url.pathname !== "/bridge/agent") {
      socket.destroy();
      return;
    }
    const session = liveSession(url.searchParams.get("id"));
    const isAgent = url.pathname === "/bridge/agent";
    const provided = isAgent
      ? tokenFromBearer(request)
      : browserToken(request);
    const expected = isAgent ? session?.agentToken : session?.token;
    if (!session || !safeEqual(provided, expected)) {
      rejectUpgrade(socket);
      return;
    }
    // A session created with a per-chat key accepts only an agent socket that presents it.
    // The browser's own leg is not checked this way: it created the session.
    if (
      isAgent &&
      session.key &&
      !safeEqual(String(request.headers["x-bridge-key"] ?? ""), session.key)
    ) {
      rejectUpgrade(socket);
      return;
    }
    touchSession(session);
    bridgeWss.handleUpgrade(request, socket, head, (ws) => {
      if (isAgent) {
        attachAgentSocket(ws, session);
      } else {
        attachBrowserSocket(ws, session);
      }
    });
  });

  const attachBrowserSocket = (ws, session) => {
    if (session.socket && session.socket !== ws) session.socket.close();
    session.socket = ws;
    ws.send(JSON.stringify({ type: "ready" }));
    ws.on("message", (data) => {
      touchSession(session);
      let message;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      if (message?.type !== "tool_result") return;
      const pending = session.pending.get(message.requestId);
      if (!pending) return;
      session.pending.delete(message.requestId);
      clearTimeout(pending.timer);
      pending.resolve(
        message.ok
          ? { ok: true, result: message.result }
          : { ok: false, error: String(message.error ?? "Bridge tool failed") },
      );
    });
    ws.on("close", () => {
      if (session.socket !== ws) return;
      session.socket = null;
      for (const [requestId, pending] of session.pending) {
        clearTimeout(pending.timer);
        pending.resolve({
          ok: false,
          error:
            "BRIDGE_OFFLINE: the browser disconnected. Continue with other OpenCode tools.",
        });
        session.pending.delete(requestId);
      }
    });
  };

  const attachAgentSocket = (ws, session) => {
    // Several MCP clients may attach to one bridge session at once: the workspace sidecar,
    // plus one stdio proxy per MCP server whose token must stay in the browser. They all
    // authorise with the same agent token and share `pending`; a request id is unique, so an
    // answer can never reach the wrong socket. A new socket therefore joins instead of
    // replacing the others.
    if (session.agentSockets.size >= MAX_AGENT_SOCKETS) {
      ws.close(1013, "too many agent sockets");
      return;
    }
    session.agentSockets.add(ws);
    ws.send(JSON.stringify({ type: "ready" }));
    ws.on("message", async (data) => {
      touchSession(session);
      let message;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      if (message?.type !== "tool_call") return;
      const result = await callBridgeBrowser(
        session,
        message.name,
        message.arguments,
      );
      if (ws.readyState !== 1) return;
      ws.send(
        JSON.stringify({
          type: "tool_result",
          requestId: message.requestId,
          ok: result.ok,
          result: result.result,
          error: result.error,
        }),
      );
    });
    ws.on("close", () => {
      session.agentSockets.delete(ws);
    });
  };

  const sweepTimer = setInterval(() => {
    sweepExpired();
    const now = Date.now();
    for (const [ip, entries] of rateLimits) {
      const recent = entries.filter(
        (createdAt) => now - createdAt < RATE_WINDOW_MS,
      );
      if (recent.length) rateLimits.set(ip, recent);
      else rateLimits.delete(ip);
    }
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref();
};
