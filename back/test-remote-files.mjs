// End-to-end smoke test for the remote file store: starts the dummy
// saia-rag-web and the real back service, then writes, lists, reads, updates,
// and deletes a file through /remote-files.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "remote-files", `__dummy-test-${Date.now()}`);
const tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), "chat-ai-remote-"));
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

const cleanup = async () => {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(tempConfigDir, { recursive: true, force: true });
};

process.on("SIGINT", () => void cleanup().finally(() => process.exit(130)));
process.on("SIGTERM", () => void cleanup().finally(() => process.exit(143)));

try {
  await fs.mkdir(root, { recursive: true });
  const dummyPort = await freePort();
  const backendPort = await freePort();

  run("dummy-rag-web.mjs", { PORT: String(dummyPort), REMOTE_FILES_DIR: root });
  await waitFor(`http://127.0.0.1:${dummyPort}/health`);

  await fs.writeFile(
    configPath,
    JSON.stringify({
      port: backendPort,
      apiEndpoint: "http://127.0.0.1:1/v1",
      apiKey: "dummy",
      serviceName: "remote-file-test",
      testMode: true,
      remoteFilesEndpoint: `http://127.0.0.1:${dummyPort}/arcanas/api/v1`,
    })
  );
  run("service.mjs", { CONFIG_LOCATION: configPath });

  const base = `http://127.0.0.1:${backendPort}/remote-files`;
  const filePath = `notes/hello.md`;
  const content = "# Hello from the dummy backend\n";

  await waitFor(`${base}?path=`);

  let response = await fetch(base, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath, content }),
  });
  assert.equal(response.status, 200, "write failed");
  let body = await response.json();
  assert.equal(body.path, filePath);

  response = await fetch(`${base}?path=notes`);
  assert.equal(response.status, 200, "list failed");
  body = await response.json();
  assert.equal(body.type, "directory");
  assert.ok(body.entries.some((entry) => entry.path === filePath), "file missing from listing");

  response = await fetch(`${base}?path=${encodeURIComponent(filePath)}`);
  body = await response.json();
  assert.equal(body.content, content, "read returned unexpected content");

  const updated = `${content}\nUpdated.\n`;
  response = await fetch(base, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath, content: updated }),
  });
  assert.equal(response.status, 200, "update failed");

  response = await fetch(`${base}?path=${encodeURIComponent(filePath)}`);
  body = await response.json();
  assert.equal(body.content, updated, "update was not stored");

  response = await fetch(`${base}?path=${encodeURIComponent(filePath)}`, {
    method: "DELETE",
  });
  assert.equal(response.status, 200, "delete failed");
  body = await response.json();
  assert.equal(body.deleted, true);

  response = await fetch(`${base}?path=${encodeURIComponent(filePath)}`);
  assert.equal(response.status, 404, "deleted file is still readable");

  console.log("\nremote file store smoke test passed");
} catch (error) {
  console.error("remote file store smoke test failed:", error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
