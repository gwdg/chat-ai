import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import express from "express";
import WebSocket from "ws";

import { registerBridge } from "./bridge.mjs";

const startBridge = async ({
  secret,
  allowAnonymous = false,
  ttlMs,
  corsOrigins = "",
} = {}) => {
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  const previousTtl = process.env.BRIDGE_SESSION_TTL_MS;
  if (ttlMs === undefined) delete process.env.BRIDGE_SESSION_TTL_MS;
  else process.env.BRIDGE_SESSION_TTL_MS = String(ttlMs);

  registerBridge({
    app,
    server,
    publicUrl: "",
    secret,
    corsOrigins,
    allowAnonymous,
  });

  if (previousTtl === undefined) delete process.env.BRIDGE_SESSION_TTL_MS;
  else process.env.BRIDGE_SESSION_TTL_MS = previousTtl;

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    wsBase: `ws://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections?.();
      }),
  };
};

const createSession = (base, headers = {}) =>
  fetch(`${base}/bridge/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ workspaceId: "workspace-1" }),
  });

const preflightAllowOrigins = async (base, origin) =>
  new Promise((resolve, reject) => {
    const target = new URL(`${base}/bridge/sessions`);
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
        },
      },
      (response) => {
        const allowOrigins = [];
        for (let index = 0; index < response.rawHeaders.length; index += 2) {
          if (response.rawHeaders[index].toLowerCase() === "access-control-allow-origin") {
            allowOrigins.push(response.rawHeaders[index + 1]);
          }
        }
        response.resume();
        response.once("end", () => resolve({ status: response.statusCode, allowOrigins }));
      },
    );
    request.once("error", reject);
    request.end();
  });

const expectUpgradeRejected = (url, extraHeaders = {}) =>
  new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = http.request({
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
        ...extraHeaders,
      },
    });
    request.once("upgrade", (_response, socket) => {
      socket.destroy();
      reject(new Error("expected the upgrade to be rejected"));
    });
    request.once("response", (response) => {
      assert.equal(response.statusCode, 401);
      response.resume();
      response.once("end", resolve);
    });
    request.once("error", reject);
    request.end();
  });


test("session creation is open without a secret, and the per-chat key pairs the legs", async () => {
  const bridge = await startBridge();
  try {
    const response = await createSession(bridge.base);
    // `back` no longer refuses to mint a session just because the deployment configured no
    // shared secret; the random per-chat key below is what pairs the two legs.
    assert.equal(response.status, 200);
    const session = await response.json();
    assert.ok(session.token);
    assert.ok(session.agentToken);
  } finally {
    await bridge.close();
  }
});

test("a wrong bridge key is rejected", async () => {
  const bridge = await startBridge({ secret: "correct-secret" });
  try {
    const response = await createSession(bridge.base, {
      "x-bridge-key": "wrong-secret",
    });
    assert.equal(response.status, 401);
  } finally {
    await bridge.close();
  }
});

test("a valid bridge key returns tokens only in the body", async () => {
  const bridge = await startBridge({ secret: "correct-secret" });
  try {
    const response = await createSession(bridge.base, {
      "x-bridge-key": "correct-secret",
    });
    assert.equal(response.status, 200);
    const session = await response.json();
    assert.ok(session.token);
    assert.ok(session.agentToken);
    assert.ok(session.expiresAt > Date.now());
    assert.ok(!session.wsUrl.includes(session.token));
    assert.ok(!session.wsUrl.includes("token="));
    assert.ok(!session.agentWsUrl.includes(session.agentToken));
    assert.ok(!session.agentWsUrl.includes("token="));
    assert.ok(!session.mcpUrl.includes(session.token));
  } finally {
    await bridge.close();
  }
});

test("session creation is limited to ten per minute per client IP", async () => {
  const bridge = await startBridge({ secret: "correct-secret" });
  try {
    for (let index = 0; index < 10; index += 1) {
      const response = await createSession(bridge.base, {
        "x-bridge-key": "correct-secret",
      });
      assert.equal(response.status, 200);
    }
    const response = await createSession(bridge.base, {
      "x-bridge-key": "correct-secret",
    });
    assert.equal(response.status, 429);
    assert.ok(Number(response.headers.get("retry-after")) >= 1);
  } finally {
    await bridge.close();
  }
});

test("wrong bridge keys are rate limited per client", async () => {
  const bridge = await startBridge({ secret: "correct-secret" });
  try {
    const headers = {
      "x-bridge-key": "wrong-secret",
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    };
    for (let index = 0; index < 10; index += 1) {
      const response = await createSession(bridge.base, headers);
      assert.equal(response.status, 401);
    }
    const limited = await createSession(bridge.base, headers);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) >= 1);

    const sameFirstHop = await createSession(bridge.base, {
      "x-bridge-key": "wrong-secret",
      "x-forwarded-for": "203.0.113.10, 10.0.0.2",
    });
    assert.equal(sameFirstHop.status, 429);
  } finally {
    await bridge.close();
  }
});

test("a right bridge key still succeeds after 20 wrong keys from another client", async () => {
  const bridge = await startBridge({ secret: "correct-secret" });
  try {
    for (let index = 0; index < 20; index += 1) {
      const response = await createSession(bridge.base, {
        "x-bridge-key": "wrong-secret",
        "x-forwarded-for": "203.0.113.11",
      });
      assert.ok(response.status === 401 || response.status === 429);
    }
    const response = await createSession(bridge.base, {
      "x-bridge-key": "correct-secret",
      "x-forwarded-for": "203.0.113.12",
    });
    assert.equal(response.status, 200);
  } finally {
    await bridge.close();
  }
});

test("bridge responses allow only same-host or configured origins", async () => {
  const bridge = await startBridge({ secret: "correct-secret" });
  try {
    const evil = await createSession(bridge.base, {
      "x-bridge-key": "correct-secret",
      Origin: "https://evil.example",
    });
    assert.equal(evil.status, 200);
    assert.equal(evil.headers.get("access-control-allow-origin"), null);

    const sameHost = await createSession(bridge.base, {
      "x-bridge-key": "correct-secret",
      Origin: bridge.base,
    });
    assert.equal(sameHost.status, 200);
    assert.equal(sameHost.headers.get("access-control-allow-origin"), bridge.base);

    const evilPreflight = await preflightAllowOrigins(
      bridge.base,
      "https://evil.example",
    );
    assert.deepEqual(evilPreflight.allowOrigins, []);

    const sameHostPreflight = await preflightAllowOrigins(bridge.base, bridge.base);
    assert.equal(sameHostPreflight.status, 204);
    assert.deepEqual(sameHostPreflight.allowOrigins, [bridge.base]);
  } finally {
    await bridge.close();
  }
});

test("a configured origin is allowed even though it is not the request host", async () => {
  // The usual dev pair is front on :8080 and `back` on :8081. The port makes it a
  // different origin, so `back.json`'s corsOrigins has to name it explicitly.
  const appOrigin = "http://127.0.0.1:8080";
  const bridge = await startBridge({
    secret: "correct-secret",
    corsOrigins: `https://chat.example, ${appOrigin}`,
  });
  try {
    const response = await createSession(bridge.base, {
      "x-bridge-key": "correct-secret",
      Origin: appOrigin,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), appOrigin);

    const preflight = await preflightAllowOrigins(bridge.base, appOrigin);
    assert.equal(preflight.status, 204);
    assert.deepEqual(preflight.allowOrigins, [appOrigin]);

    // A configured list is still an allowlist.
    const other = await preflightAllowOrigins(bridge.base, "http://127.0.0.1:8081");
    assert.deepEqual(other.allowOrigins, []);
  } finally {
    await bridge.close();
  }
});

test("a query token without a subprotocol cannot upgrade", async () => {
  const bridge = await startBridge({ secret: "correct-secret" });
  try {
    const created = await createSession(bridge.base, {
      "x-bridge-key": "correct-secret",
    });
    const session = await created.json();
    await expectUpgradeRejected(`${session.wsUrl}&token=${session.token}`);
  } finally {
    await bridge.close();
  }
});

test("the browser token subprotocol upgrades and echoes bridge.v1", async () => {
  const bridge = await startBridge({ secret: "correct-secret" });
  try {
    const created = await createSession(bridge.base, {
      "x-bridge-key": "correct-secret",
    });
    const session = await created.json();
    const socket = new WebSocket(session.wsUrl, [
      "bridge.v1",
      `bridge-token.${session.token}`,
    ]);
    const errors = [];
    socket.on("error", (error) => errors.push(error));
    const ready = once(socket, "message");
    await once(socket, "open");
    assert.equal(socket.protocol, "bridge.v1");
    const [message] = await ready;
    assert.deepEqual(JSON.parse(String(message)), { type: "ready" });
    socket.close();
    await once(socket, "close");
    assert.deepEqual(errors, []);
  } finally {
    await bridge.close();
  }
});

test("the agent leg must present the per-chat key the session was created with", async () => {
  const bridge = await startBridge();
  try {
    const created = await fetch(`${bridge.base}/bridge/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: "workspace-1", key: "chat-key" }),
    });
    assert.equal(created.status, 200);
    const session = await created.json();

    // The token alone is not enough: the page generated this key for the chat and put it into
    // the stdio entry's environment, so a socket that only knows the URL cannot attach.
    await expectUpgradeRejected(session.agentWsUrl, {
      Authorization: `Bearer ${session.agentToken}`,
    });
    await expectUpgradeRejected(session.agentWsUrl, {
      Authorization: `Bearer ${session.agentToken}`,
      "x-bridge-key": "another-chat",
    });

    const socket = new WebSocket(session.agentWsUrl, {
      headers: {
        Authorization: `Bearer ${session.agentToken}`,
        "x-bridge-key": "chat-key",
      },
    });
    const ready = once(socket, "message");
    await once(socket, "open");
    const [message] = await ready;
    assert.deepEqual(JSON.parse(String(message)), { type: "ready" });
    socket.close();
    await once(socket, "close");
  } finally {
    await bridge.close();
  }
});

test("an expired session is rejected", async () => {
  const bridge = await startBridge({ secret: "correct-secret", ttlMs: 25 });
  try {
    const created = await createSession(bridge.base, {
      "x-bridge-key": "correct-secret",
    });
    const session = await created.json();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const response = await fetch(`${bridge.base}/bridge/mcp/${session.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    assert.equal(response.status, 401);
  } finally {
    await bridge.close();
  }
});

const mcp = (bridge, session, body) =>
  fetch(`${bridge.base}/bridge/mcp/${session.id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body }),
  }).then((response) => response.json());

test("the MCP endpoint advertises resources and answers the empty lists", async () => {
  const bridge = await startBridge({ secret: "correct-secret" });
  try {
    const created = await createSession(bridge.base, {
      "x-bridge-key": "correct-secret",
    });
    const session = await created.json();

    // An error here is what a client's MCP panel shows as a broken server.
    const initialized = await mcp(bridge, session, { method: "initialize" });
    assert.deepEqual(initialized.result.capabilities.resources, {
      subscribe: false,
      listChanged: false,
    });

    const templates = await mcp(bridge, session, {
      method: "resources/templates/list",
    });
    assert.equal(
      templates.result.resourceTemplates[0].uriTemplate,
      "chatai-workspace:///{path}",
    );

    // No prompts are served, but the answer is a list, not an error.
    const prompts = await mcp(bridge, session, { method: "prompts/list" });
    assert.deepEqual(prompts.result, { prompts: [] });

    // A uri that is not a workspace path is refused without a browser call.
    const foreign = await mcp(bridge, session, {
      method: "resources/read",
      params: { uri: "file:///etc/passwd" },
    });
    assert.equal(foreign.error.code, -32602);
  } finally {
    await bridge.close();
  }
});

test("resources/list and resources/read relay to the connected browser", async () => {
  const bridge = await startBridge({ secret: "correct-secret" });
  try {
    const created = await createSession(bridge.base, {
      "x-bridge-key": "correct-secret",
    });
    const session = await created.json();
    const socket = new WebSocket(session.wsUrl, [
      "bridge.v1",
      `bridge-token.${session.token}`,
    ]);
    // The bridge sends {"type":"ready"} on attach; wait for it before asking.
    await once(socket, "message");

    const asked = [];
    socket.on("message", (data) => {
      const message = JSON.parse(String(data));
      if (message.type !== "tool_call") return;
      asked.push(`${message.name}:${message.arguments.path}`);
      const path = message.arguments.path;
      let result = [];
      if (message.name === "workspace_list" && path === "/") {
        result = [
          { name: "notes.md", dir: false },
          { name: "docs", dir: true },
        ];
      } else if (message.name === "workspace_list") {
        result = [{ name: "guide.md", dir: false }];
      } else if (message.name === "workspace_read") {
        result = { path, size: 5, content: "hello" };
      }
      socket.send(
        JSON.stringify({
          type: "tool_result",
          requestId: message.requestId,
          ok: true,
          result,
        }),
      );
    });

    const listed = await mcp(bridge, session, { method: "resources/list" });
    assert.deepEqual(
      listed.result.resources.map((item) => item.uri),
      ["chatai-workspace:///notes.md", "chatai-workspace:///docs/guide.md"],
    );
    assert.equal(listed.result.resources[0].mimeType, "text/markdown");

    const read = await mcp(bridge, session, {
      method: "resources/read",
      params: { uri: "chatai-workspace:///notes.md" },
    });
    assert.equal(read.result.contents[0].text, "hello");
    assert.equal(read.result.contents[0].mimeType, "text/markdown");
    assert.ok(asked.includes("workspace_read:/notes.md"));

    socket.close();
    await once(socket, "close");
  } finally {
    await bridge.close();
  }
});
