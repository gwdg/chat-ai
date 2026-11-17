import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import express from "express";
import WebSocket from "ws";

import { registerBridge } from "./bridge.mjs";

const startBridge = async ({ secret, allowAnonymous = false, ttlMs } = {}) => {
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

const expectUpgradeRejected = (url) =>
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


test("session creation is disabled when no secret is configured", async () => {
  const bridge = await startBridge();
  try {
    const response = await createSession(bridge.base);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "bridge disabled" });
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
