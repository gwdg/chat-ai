// End-to-end test for `/feedback`: starts a dummy receiver and the real back
// service, then checks that a report (multipart), a rating (JSON), the history
// listing and the delete call all reach the receiver, and that the caller's
// identity arrives as `x-auth-claim-uid` even when the gateway only injects
// `oidc_claim_uid` (which is what `saia-feedback` reads).
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), "chat-ai-feedback-"));
const configPath = path.join(tempConfigDir, "back.json");
const children = [];

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const waitFor = async (url, attempts = 100) => {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const run = (script, env) => {
  const child = spawn(process.execPath, [path.join(here, script)], {
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  children.push(child);
  return child;
};

// The receiver records what it was given and answers like `saia-feedback` does.
const received = [];
const receiver = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    received.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    });
    res.writeHead(req.method === "POST" ? 201 : 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: "gwdg/chat-ai/1" }));
  });
});

const cleanup = async () => {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  receiver.close();
  await fs.rm(tempConfigDir, { recursive: true, force: true });
};

process.on("SIGINT", () => void cleanup().finally(() => process.exit(130)));
process.on("SIGTERM", () => void cleanup().finally(() => process.exit(143)));

try {
  const receiverPort = await freePort();
  const backendPort = await freePort();
  await new Promise((resolve) => receiver.listen(receiverPort, "127.0.0.1", resolve));

  await fs.writeFile(
    configPath,
    JSON.stringify({
      port: backendPort,
      apiEndpoint: "http://127.0.0.1:1/v1",
      apiKey: "dummy",
      serviceName: "feedback-test",
      testMode: true,
      feedbackEndpoint: `http://127.0.0.1:${receiverPort}/feedback`,
      feedbackToken: "receiver-token",
    })
  );
  run("service.mjs", { CONFIG_LOCATION: configPath });

  const base = `http://127.0.0.1:${backendPort}/feedback`;
  await waitFor(base);

  // A bug report: multipart, sent with only oidc_claim_uid (the gateway's
  // header), which back has to hand over as the identity saia-feedback reads.
  const report = new FormData();
  report.append("payload", JSON.stringify({ type: "bug", message: "The button does nothing." }));
  report.append("screenshots", new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }), "shot.png");
  let response = await fetch(base, {
    method: "POST",
    headers: { oidc_claim_uid: "alice" },
    body: report,
  });
  assert.equal(response.status, 201, "report was not accepted");
  let body = await response.json();
  assert.equal(body.id, "gwdg/chat-ai/1", "receiver answer was not relayed");

  let seen = received.at(-1);
  assert.equal(seen.method, "POST");
  assert.equal(seen.headers["x-auth-claim-uid"], "alice", "oidc_claim_uid was not mapped");
  assert.equal(seen.headers["oidc_claim_uid"], "alice", "the original identity header was dropped");
  assert.equal(seen.headers.authorization, "Bearer receiver-token", "feedbackToken was not sent");
  assert.match(seen.headers["content-type"], /^multipart\/form-data; boundary=/);
  assert.match(seen.body, /name="payload"/);
  assert.match(seen.body, /The button does nothing\./);
  assert.match(seen.body, /name="screenshots"/);

  // An identity header that is already there wins and is not overwritten.
  response = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-claim-uid": "bob", oidc_claim_uid: "ignored" },
    body: JSON.stringify({ rating: "down", comment: "too long" }),
  });
  assert.equal(response.status, 201, "rating was not accepted");
  seen = received.at(-1);
  assert.equal(seen.headers["x-auth-claim-uid"], "bob");
  assert.equal(seen.headers["content-type"], "application/json");
  assert.match(seen.body, /"rating":"down"/, "the JSON body was rebuilt instead of forwarded");

  // The Profile screen's history: the query string and identity pass through.
  response = await fetch(`${base}?limit=200&kind=report`, {
    headers: { oidc_claim_uid: "alice" },
  });
  assert.equal(response.status, 200, "listing failed");
  seen = received.at(-1);
  assert.equal(seen.method, "GET");
  assert.equal(seen.url, "/feedback?limit=200&kind=report");
  assert.equal(seen.headers["x-auth-claim-uid"], "alice");

  // Deleting everything the caller sent goes to the same receiver.
  response = await fetch(base, { method: "DELETE", headers: { oidc_claim_uid: "alice" } });
  assert.equal(response.status, 200, "delete failed");
  seen = received.at(-1);
  assert.equal(seen.method, "DELETE");
  assert.equal(seen.headers["x-auth-claim-uid"], "alice");

  // A receiver behind a proxy that already supplies x-consumer-custom-id is
  // used as the identity too.
  response = await fetch(base, {
    method: "GET",
    headers: { "x-consumer-custom-id": "carol" },
  });
  assert.equal(response.status, 200);
  seen = received.at(-1);
  assert.equal(seen.headers["x-auth-claim-uid"], "carol");

  console.log("\nfeedback relay test passed");
} catch (error) {
  console.error("feedback relay test failed:", error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
