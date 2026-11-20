// End-to-end test of the bridge as a *directly connected* OpenCode agent uses it.
//
// `test-bridge.mjs` checks the host protocol with a hand-rolled socket per case. This file
// clones that setup but runs the pieces the app actually runs: the real `bridge.mjs` host, the
// real `bridge-sidecar.mjs` as a stdio MCP server (exactly the command `useAgentBridge` registers
// from `opencodeBridgeSidecarCommand`), and a browser leg whose tool answers reproduce
// `useAgentBridge#handleToolCall` — an in-memory workspace tree for `workspace_*` and a real MCP
// server for `mcp_*`. Nothing is mocked on the bridge's own side: every answer the sidecar prints
// came back over a WebSocket from the "browser".
//
// The last test drives a live OpenCode server (`DIRECT_OPENCODE_URL`, default
// http://127.0.0.1:9000) so the whole path is proven against a real agent process: agent →
// OpenCode → bridge entry → bridge host → browser socket → workspace/MCP answer → model. It
// registers the HTTP entry (`mcpUrl` + bearer token), which is what a direct agent uses when no
// `opencodeBridgeSidecarCommand` is configured; `DIRECT_OPENCODE_SIDECAR=<absolute path on the
// agent host>` swaps in the stdio sidecar instead. It skips itself when no password is
// configured, because it needs a running server and a tool-capable model.
//
//   node --test back/test-bridge-direct.mjs
//   DIRECT_OPENCODE_URL=http://127.0.0.1:9000 DIRECT_OPENCODE_PASSWORD=… \
//     node --test back/test-bridge-direct.mjs

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import WebSocket from "ws";

import { registerBridge } from "./bridge.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SIDECAR = join(HERE, "bridge-sidecar.mjs");
const SECRET = "test-bridge-secret";

const LIVE_URL = String(process.env.DIRECT_OPENCODE_URL || "http://127.0.0.1:9000").replace(
  /\/+$/,
  "",
);
const LIVE_USERNAME = process.env.DIRECT_OPENCODE_USERNAME || "opencode";
const LIVE_PASSWORD = process.env.DIRECT_OPENCODE_PASSWORD || "";
const LIVE_MODEL = process.env.DIRECT_OPENCODE_MODEL || "";

const startBridge = async ({ secret = SECRET, corsOrigins = "" } = {}) => {
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  registerBridge({
    app,
    server,
    publicUrl: "",
    secret,
    corsOrigins,
    allowAnonymous: false,
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections?.();
      }),
  };
};

const createSession = async (base, body = {}) => {
  const response = await fetch(`${base}/bridge/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bridge-key": SECRET },
    body: JSON.stringify({ workspaceId: "workspace-1", ...body }),
  });
  assert.equal(response.status, 200, "the bridge must mint a session");
  return response.json();
};

/** A streamable-HTTP MCP server, so `mcp_call` is a genuine protocol round trip. */
const startMcpServer = async () => {
  const calls = [];
  const app = express();
  app.use(express.json());
  app.post("/mcp", (req, res) => {
    const { id, method, params } = req.body ?? {};
    const ok = (result) => res.json({ jsonrpc: "2.0", id, result });
    if (method === "initialize") {
      return ok({
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "direct-bridge-test-mcp", version: "1.0.0" },
      });
    }
    if (method === "tools/list") {
      return ok({
        tools: [
          {
            name: "echo",
            description: "Echo the given text",
            inputSchema: {
              type: "object",
              properties: { text: { type: "string" } },
              required: ["text"],
            },
          },
        ],
      });
    }
    if (method === "tools/call") {
      const args = params?.arguments ?? {};
      calls.push({ name: params?.name, arguments: args });
      return ok({
        content: [{ type: "text", text: `echo:${String(args.text ?? "")}` }],
        isError: false,
      });
    }
    return res.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `unsupported method ${method}` },
    });
  });
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    calls,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections?.();
      }),
  };
};

/**
 * The browser's workspace, as `WorkspaceAgentVfs` presents it: `readdir` returns
 * `{ name, dir }` entries, reads come back as `{ path, size, content }` and writes report what
 * they touched. Paths are normalized the way `workspace/paths.ts#joinPath` does.
 */
const makeWorkspace = (files = {}) => {
  const nodes = new Map([["/", { dir: true }]]);
  const normalize = (value) =>
    `/${String(value ?? "/")
      .split("/")
      .filter(Boolean)
      .join("/")}`;
  const ensureParents = (path) => {
    const segments = normalize(path).split("/").filter(Boolean);
    let current = "";
    for (const segment of segments.slice(0, -1)) {
      current += `/${segment}`;
      if (!nodes.has(current)) nodes.set(current, { dir: true });
    }
  };
  const put = (path, content) => {
    const normalized = normalize(path);
    ensureParents(normalized);
    nodes.set(normalized, { dir: false, content: String(content) });
  };
  for (const [path, content] of Object.entries(files)) put(path, content);

  const dirOf = (path) => {
    const parent = path.replace(/\/[^/]+$/, "") || "/";
    return parent;
  };

  return {
    put,
    nodes,
    list(path) {
      const normalized = normalize(path);
      const node = nodes.get(normalized);
      if (!node?.dir) throw new Error(`Not a folder: ${normalized}`);
      const prefix = normalized === "/" ? "/" : `${normalized}/`;
      return [...nodes.keys()]
        .filter((candidate) => candidate !== normalized && candidate.startsWith(prefix))
        .filter((candidate) => !candidate.slice(prefix.length).includes("/"))
        .map((candidate) => ({
          name: candidate.slice(prefix.length),
          dir: nodes.get(candidate).dir,
        }));
    },
    stat(path) {
      const node = nodes.get(normalize(path));
      return node ? { dir: node.dir } : null;
    },
    read(path) {
      const normalized = normalize(path);
      const node = nodes.get(normalized);
      if (!node || node.dir) throw new Error(`No such file: ${normalized}`);
      return node.content;
    },
    write(path, content) {
      put(path, content);
    },
    mkdir(path) {
      const normalized = normalize(path);
      ensureParents(`${normalized}/x`);
      nodes.set(normalized, { dir: true });
    },
    remove(path) {
      const normalized = normalize(path);
      if (!nodes.has(normalized)) throw new Error(`No such entry: ${normalized}`);
      const prefix = `${normalized}/`;
      for (const candidate of [...nodes.keys()]) {
        if (candidate === normalized || candidate.startsWith(prefix)) nodes.delete(candidate);
      }
    },
    dirOf,
  };
};

/**
 * The browser leg: the same socket the app opens (`bridge.v1` + `bridge-token.<token>`
 * subprotocols) and the same answers `useAgentBridge#handleToolCall` sends back.
 */
const connectBrowser = async (session, { workspace, mcpServers = [], writable = true } = {}) => {
  const calls = [];
  const socket = new WebSocket(session.wsUrl, [
    "bridge.v1",
    `bridge-token.${session.token}`,
  ]);
  const ready = new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  const callMcpTool = async (server, tool, args) => {
    const response = await fetch(server.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: tool, arguments: args },
      }),
    });
    const body = await response.json();
    return body.result ?? body.error;
  };

  const answer = async (message) => {
    const { requestId, name, arguments: args = {} } = message;
    calls.push({ name, arguments: args });
    try {
      let result;
      if (name.startsWith("workspace_")) {
        const path = `/${String(args.path ?? "/").replace(/^\/+/, "")}`;
        if (name === "workspace_list") result = workspace.list(path);
        else if (name === "workspace_stat") {
          const stat = workspace.stat(path);
          result = { path, exists: !!stat, dir: stat?.dir ?? false };
        } else if (name === "workspace_read") {
          const content = workspace.read(path);
          result = { path, size: content.length, content };
        } else if (name === "workspace_write") {
          if (!writable) throw new Error("Workspace writes are disabled for this agent.");
          workspace.write(path, String(args.content ?? ""));
          result = { path, written: true };
        } else if (name === "workspace_mkdir") {
          if (!writable) throw new Error("Workspace writes are disabled for this agent.");
          workspace.mkdir(path);
          result = { path, created: true };
        } else if (name === "workspace_remove") {
          if (!writable) throw new Error("Workspace writes are disabled for this agent.");
          workspace.remove(path);
          result = { path, removed: true };
        } else {
          throw new Error(`Unknown workspace tool: ${name}`);
        }
      } else if (name === "mcp_list_servers") {
        result = mcpServers.map((server) => ({
          id: server.id,
          name: server.name || server.id,
        }));
      } else if (name === "mcp_list_tools") {
        const server = mcpServers.find(
          (item) => item.id === args.server || item.name === args.server,
        );
        if (!server) throw new Error(`Unknown MCP server: ${args.server}`);
        result = await fetch(server.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        }).then((response) => response.json().then((body) => body.result?.tools ?? []));
      } else if (name === "mcp_call") {
        const server = mcpServers.find(
          (item) => item.id === args.server || item.name === args.server,
        );
        if (!server) throw new Error(`Unknown MCP server: ${args.server}`);
        result = await callMcpTool(server, String(args.tool ?? ""), args.arguments ?? {});
      } else {
        throw new Error(`Unknown bridge tool: ${name}`);
      }
      socket.send(JSON.stringify({ type: "tool_result", requestId, ok: true, result }));
    } catch (reason) {
      socket.send(
        JSON.stringify({
          type: "tool_result",
          requestId,
          ok: false,
          error: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    }
  };

  socket.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(String(data));
    } catch {
      return;
    }
    if (message?.type === "tool_call") void answer(message);
  });

  await ready;
  return {
    calls,
    socket,
    close: async () => {
      socket.close();
      if (socket.readyState !== socket.CLOSED) await once(socket, "close");
    },
  };
};

/** The stdio MCP server OpenCode spawns: `bridge-sidecar.mjs` with the app's env. */
const startSidecar = async (session, { scopes = "workspace,write,mcp" } = {}) => {
  const child = spawn(process.execPath, [SIDECAR], {
    env: {
      ...process.env,
      CHAT_AI_BRIDGE_URL: session.agentWsUrl,
      CHAT_AI_BRIDGE_TOKEN: session.agentToken,
      CHAT_AI_BRIDGE_SCOPES: scopes,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let nextId = 1;
  const pending = new Map();
  let buffer = "";
  let stderr = "";
  let connected;
  const online = new Promise((resolve) => {
    connected = resolve;
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    if (stderr.includes("Chat AI bridge connected")) connected();
  });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      const entry = pending.get(message.id);
      if (!entry) continue;
      pending.delete(message.id);
      clearTimeout(entry.timer);
      entry.resolve(message);
    }
  });

  const rpc = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`sidecar did not answer ${method}\n${stderr}`));
      }, 20000);
      pending.set(id, { resolve, timer });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });

  await online;
  const stop = async () => {
    child.kill("SIGTERM");
    if (child.exitCode === null) await once(child, "exit").catch(() => {});
  };

  void rpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "direct-bridge-test", version: "1.0.0" },
  }).then(() =>
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`),
  );

  return { rpc, stop, stderrText: () => stderr };
};

const bridgeSession = async (base, body) => createSession(base, body);

test("the direct-agent sidecar advertises workspace, write and MCP tools", async () => {
  const bridge = await startBridge();
  const workspace = makeWorkspace({ "/notes.md": "hello" });
  let browser;
  let sidecar;
  try {
    const session = await bridgeSession(bridge.base, { writable: true, mcp: true });
    browser = await connectBrowser(session, { workspace });
    sidecar = await startSidecar(session);

    const listed = await sidecar.rpc("tools/list", {});
    const names = listed.result.tools.map((tool) => tool.name);
    assert.deepEqual(names, [
      "workspace_list",
      "workspace_stat",
      "workspace_read",
      "workspace_write",
      "workspace_mkdir",
      "workspace_remove",
      "mcp_list_servers",
      "mcp_list_tools",
      "mcp_call",
    ]);

    // Read-only scopes must not advertise the mutating half.
    const previous = sidecar;
    await previous.stop();
    const readOnly = await startSidecar(session, { scopes: "workspace" });
    sidecar = readOnly;
    const readOnlyNames = (await readOnly.rpc("tools/list", {})).result.tools.map(
      (tool) => tool.name,
    );
    assert.deepEqual(readOnlyNames, ["workspace_list", "workspace_stat", "workspace_read"]);
  } finally {
    await sidecar?.stop();
    await browser?.close();
    await bridge.close();
  }
});

test("workspace tools read and write the browser's files", async () => {
  const bridge = await startBridge();
  const workspace = makeWorkspace({ "/notes.md": "hello from the browser" });
  let browser;
  let sidecar;
  try {
    const session = await bridgeSession(bridge.base, { writable: true });
    browser = await connectBrowser(session, { workspace });
    sidecar = await startSidecar(session, { scopes: "workspace,write" });

    const listed = await sidecar.rpc("tools/call", {
      name: "workspace_list",
      arguments: { path: "/" },
    });
    assert.deepEqual(JSON.parse(listed.result.content[0].text), [
      { name: "notes.md", dir: false },
    ]);

    const read = await sidecar.rpc("tools/call", {
      name: "workspace_read",
      arguments: { path: "/notes.md" },
    });
    assert.equal(read.result.isError, false);
    assert.equal(JSON.parse(read.result.content[0].text).content, "hello from the browser");

    const written = await sidecar.rpc("tools/call", {
      name: "workspace_write",
      arguments: { path: "/artefacts/generated.md", content: "# written by the agent" },
    });
    assert.equal(written.result.isError, false);
    assert.equal(
      JSON.parse(written.result.content[0].text).written,
      true,
      "the write must reach the browser",
    );
    // The assertion that matters: the browser's tree changed, not just the answer.
    assert.equal(workspace.read("/artefacts/generated.md"), "# written by the agent");
    assert.deepEqual(workspace.stat("/artefacts/generated.md"), { dir: false });

    const removed = await sidecar.rpc("tools/call", {
      name: "workspace_remove",
      arguments: { path: "/artefacts" },
    });
    assert.equal(JSON.parse(removed.result.content[0].text).removed, true);
    assert.equal(workspace.stat("/artefacts"), null);

    const stat = await sidecar.rpc("tools/call", {
      name: "workspace_stat",
      arguments: { path: "/notes.md" },
    });
    assert.deepEqual(JSON.parse(stat.result.content[0].text), {
      path: "/notes.md",
      exists: true,
      dir: false,
    });
  } finally {
    await sidecar?.stop();
    await browser?.close();
    await bridge.close();
  }
});

test("the MCP relay reaches a configured server through the browser", async () => {
  const bridge = await startBridge();
  const mcp = await startMcpServer();
  const workspace = makeWorkspace();
  const servers = [{ id: "mcp-1", name: "Test MCP", url: mcp.url }];
  let browser;
  let sidecar;
  try {
    const session = await bridgeSession(bridge.base, { writable: true, mcp: true });
    browser = await connectBrowser(session, { workspace, mcpServers: servers });
    sidecar = await startSidecar(session);

    const listedServers = await sidecar.rpc("tools/call", {
      name: "mcp_list_servers",
      arguments: {},
    });
    assert.deepEqual(JSON.parse(listedServers.result.content[0].text), [
      { id: "mcp-1", name: "Test MCP" },
    ]);

    const listedTools = await sidecar.rpc("tools/call", {
      name: "mcp_list_tools",
      arguments: { server: "Test MCP" },
    });
    assert.deepEqual(
      JSON.parse(listedTools.result.content[0].text).map((tool) => tool.name),
      ["echo"],
    );

    const called = await sidecar.rpc("tools/call", {
      name: "mcp_call",
      arguments: { server: "mcp-1", tool: "echo", arguments: { text: "bridge" } },
    });
    assert.equal(called.result.isError, false);
    assert.equal(JSON.parse(called.result.content[0].text).content[0].text, "echo:bridge");
    // The MCP server itself saw the call: the relay is not simulated either.
    assert.deepEqual(mcp.calls, [{ name: "echo", arguments: { text: "bridge" } }]);

    const unknown = await sidecar.rpc("tools/call", {
      name: "mcp_call",
      arguments: { server: "nope", tool: "echo", arguments: {} },
    });
    assert.equal(unknown.result.isError, true);
    assert.match(unknown.result.content[0].text, /Unknown MCP server/);
  } finally {
    await sidecar?.stop();
    await browser?.close();
    await mcp.close();
    await bridge.close();
  }
});

test("workspace files are MCP resources too, without a tool call", async () => {
  const bridge = await startBridge();
  const workspace = makeWorkspace({
    "/notes.md": "hello",
    "/docs/guide.md": "# guide",
  });
  let browser;
  let sidecar;
  try {
    const session = await bridgeSession(bridge.base, { writable: true });
    browser = await connectBrowser(session, { workspace });
    sidecar = await startSidecar(session);

    const listed = await sidecar.rpc("resources/list", {});
    assert.deepEqual(
      listed.result.resources.map((resource) => resource.uri).sort(),
      ["chatai-workspace:///docs/guide.md", "chatai-workspace:///notes.md"],
    );
    assert.equal(
      listed.result.resources.find((resource) => resource.uri.endsWith("/notes.md")).mimeType,
      "text/markdown",
    );

    const read = await sidecar.rpc("resources/read", {
      uri: "chatai-workspace:///notes.md",
    });
    assert.equal(read.result.contents[0].text, "hello");

    const templates = await sidecar.rpc("resources/templates/list", {});
    assert.equal(templates.result.resourceTemplates[0].uriTemplate, "chatai-workspace:///{path}");
  } finally {
    await sidecar?.stop();
    await browser?.close();
    await bridge.close();
  }
});

test("a tool call without a connected browser fails instead of hanging", async () => {
  const bridge = await startBridge();
  const workspace = makeWorkspace({ "/notes.md": "hello" });
  let browser;
  let sidecar;
  try {
    const session = await bridgeSession(bridge.base, { writable: true });
    browser = await connectBrowser(session, { workspace });
    sidecar = await startSidecar(session, { scopes: "workspace" });
    await browser.close();
    browser = null;

    const started = Date.now();
    const read = await sidecar.rpc("tools/call", {
      name: "workspace_read",
      arguments: { path: "/notes.md" },
    });
    assert.equal(read.result.isError, true);
    assert.match(read.result.content[0].text, /BRIDGE_OFFLINE/);
    assert.ok(Date.now() - started < 10000, "the failure must be immediate, not a timeout");
  } finally {
    await sidecar?.stop();
    await bridge.close();
  }
});

test("the HTTP fallback answers the same tool call", async () => {
  const bridge = await startBridge();
  const workspace = makeWorkspace({ "/notes.md": "hello over http" });
  let browser;
  try {
    const session = await bridgeSession(bridge.base, { writable: true, mcp: true });
    browser = await connectBrowser(session, { workspace });

    const rpc = async (method, params) => {
      const response = await fetch(session.mcpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 7, method, params }),
      });
      return response.json();
    };

    const initialized = await rpc("initialize", {});
    assert.equal(initialized.result.serverInfo.name, "chat-ai-bridge");

    const listed = await rpc("tools/list", {});
    assert.ok(listed.result.tools.some((tool) => tool.name === "workspace_read"));

    const read = await rpc("tools/call", {
      name: "workspace_read",
      arguments: { path: "/notes.md" },
    });
    assert.equal(JSON.parse(read.result.content[0].text).content, "hello over http");
  } finally {
    await browser?.close();
    await bridge.close();
  }
});

/**
 * The live leg: a real OpenCode server spawns the sidecar from the same config the app writes and
 * a real model decides to use it. This is the only check that proves the registration, the stdio
 * transport and the tool result reaching the model all work together.
 */
const liveFetch = (path, init = {}) =>
  fetch(`${LIVE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Basic ${Buffer.from(`${LIVE_USERNAME}:${LIVE_PASSWORD}`).toString("base64")}`,
      ...(init.headers ?? {}),
    },
  }).then(async (response) => ({
    status: response.status,
    body: await response.json().catch(() => null),
  }));

const waitFor = async (check, { timeout = 120000, interval = 1000, label = "condition" } = {}) => {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

test("a real direct OpenCode agent drives the bridge", { timeout: 240000 }, async (t) => {
  if (!LIVE_PASSWORD) {
    t.skip("set DIRECT_OPENCODE_PASSWORD to run the live direct-agent leg");
    return;
  }
  const info = await liveFetch("/api/info").catch(() => null);
  if (!info || info.status !== 200) {
    t.skip(`no OpenCode server answering at ${LIVE_URL}`);
    return;
  }
  t.diagnostic(`OpenCode ${info.body?.version} at ${LIVE_URL}`);

  const bridge = await startBridge();
  const mcp = await startMcpServer();
  const workspace = makeWorkspace({
    "/notes.md": "BRIDGE_LIVE_MARKER: the browser owns this file",
  });
  const servers = [{ id: "mcp-1", name: "Live MCP", url: mcp.url }];
  let browser;
  let sidecarEntry = "";
  let opencodeSession = "";
  let browserSession;
  try {
    // The model must be able to call tools; the deployment names its own.
    const models = await liveFetch("/api/model");
    const candidates = (models.body?.data ?? []).filter(
      (model) => model?.capabilities?.tools === true && model?.type === "chat",
    );
    const model =
      candidates.find((item) => item.id === LIVE_MODEL) ??
      candidates.find((item) => /free/i.test(item.id)) ??
      candidates[0];
    assert.ok(model, "the server must offer a tool-capable model");

    opencodeSession = (
      await liveFetch("/api/session", {
        method: "POST",
        body: JSON.stringify({ title: "chat-ai bridge direct test" }),
      })
    ).body?.data?.id;
    assert.ok(opencodeSession?.startsWith("ses_"), "a session must be created");
    await liveFetch(`/api/session/${opencodeSession}/model`, {
      method: "POST",
      body: JSON.stringify({ model: { id: model.id, providerID: model.providerID } }),
    });

    browserSession = await bridgeSession(bridge.base, {
      workspaceId: "workspace-1",
      agentId: "agent-1",
      writable: true,
      mcp: true,
    });
    browser = await connectBrowser(browserSession, { workspace, mcpServers: servers });
    sidecarEntry = `chatai-bridge-${opencodeSession}`;

    // Exactly what `useAgentBridge` registers. With no `opencodeBridgeSidecarCommand`
    // configured (the default for a direct agent) that is the remote HTTP leg at
    // `mcpUrl`; naming `DIRECT_OPENCODE_SIDECAR` switches to the stdio sidecar, whose
    // path must exist on the *agent's* host, not on the machine running this test.
    const sidecarPath = process.env.DIRECT_OPENCODE_SIDECAR || "";
    const config = sidecarPath
      ? {
          type: "local",
          command: [process.execPath, sidecarPath],
          codemode: false,
          environment: {
            CHAT_AI_BRIDGE_URL: browserSession.agentWsUrl,
            CHAT_AI_BRIDGE_TOKEN: browserSession.agentToken,
            CHAT_AI_BRIDGE_SCOPES: "workspace,write,mcp",
          },
        }
      : {
          type: "remote",
          url: browserSession.mcpUrl,
          headers: { Authorization: `Bearer ${browserSession.token}` },
          codemode: false,
        };
    t.diagnostic(`registering the ${config.type} MCP entry`);
    const registered = await liveFetch(
      `/api/experimental/mcp/${encodeURIComponent(sidecarEntry)}`,
      { method: "PUT", body: JSON.stringify({ config }) },
    );
    assert.ok([200, 204].includes(registered.status), `PUT mcp: ${registered.status}`);
    await liveFetch(`/api/experimental/mcp/${encodeURIComponent(sidecarEntry)}/connect`, {
      method: "POST",
    });

    // Let the session use exactly this entry, as `agentMcpScope.js` scopes it.
    await liveFetch(`/api/session/${opencodeSession}`, {
      method: "PATCH",
      body: JSON.stringify({
        permissions: [
          { action: `${sidecarEntry}_*`, resource: "*", effect: "allow" },
          { action: "opencode_list_mcp_resources", resource: sidecarEntry, effect: "allow" },
        ],
      }),
    });

    const connected = await waitFor(
      async () => {
        const listed = await liveFetch("/api/mcp");
        const entry = (listed.body?.data ?? []).find((item) => item.name === sidecarEntry);
        return entry?.status?.status === "connected" ? entry : null;
      },
      { timeout: 60000, label: "the bridge MCP entry to connect" },
    );
    t.diagnostic(`bridge entry connected (${connected.status?.status})`);

    await liveFetch(`/api/session/${opencodeSession}/prompt`, {
      method: "POST",
      body: JSON.stringify({
        text:
          "Use the workspace_read tool on /notes.md and reply with its exact contents. " +
          "Then call mcp_list_servers and use mcp_call on the first server with tool echo " +
          'and arguments {"text":"live"}. Do not use any other tool.',
      }),
    });

    // The bridge browser leg is the proof: the model's tool call only lands here if
    // OpenCode connected the entry, the entry reached the bridge and the relay worked.
    const call = await waitFor(
      async () => browser.calls.find((item) => item.name === "workspace_read") ?? null,
      { timeout: 150000, interval: 500, label: "the agent to call workspace_read" },
    );
    assert.equal(call.arguments.path, "/notes.md");
    t.diagnostic(`agent called ${call.name} ${JSON.stringify(call.arguments)}`);

    // The MCP half: the relay must reach the user's server, not just our own workspace.
    const relayed = await waitFor(
      async () => browser.calls.find((item) => item.name === "mcp_call") ?? null,
      { timeout: 120000, interval: 500, label: "the agent to call mcp_call" },
    );
    assert.equal(relayed.arguments.tool, "echo");
    assert.ok(
      mcp.calls.some((item) => item.name === "echo"),
      "the MCP server itself must have served the call",
    );
    t.diagnostic(`agent called ${relayed.name} on ${relayed.arguments.server}`);

    const answered = await waitFor(
      async () =>
        (await liveFetch(`/api/session/${opencodeSession}/message?order=asc`)).body?.data?.find(
          (message) =>
            message?.type !== "idle" &&
            JSON.stringify(message).includes("BRIDGE_LIVE_MARKER"),
        ) ?? null,
      { timeout: 120000, interval: 1000, label: "the file contents to reach the model" },
    );
    assert.ok(answered, "the model must have seen the browser's file contents");
  } finally {
    if (opencodeSession) {
      await liveFetch(`/api/session/${opencodeSession}`, { method: "DELETE" }).catch(() => {});
    }
    if (sidecarEntry) {
      await liveFetch(`/api/experimental/mcp/${encodeURIComponent(sidecarEntry)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
    if (browser) await browser.close();
    if (browserSession) {
      await fetch(`${bridge.base}/bridge/sessions/${browserSession.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${browserSession.token}` },
      }).catch(() => {});
    }
    await mcp.close();
    await bridge.close();
  }
});
