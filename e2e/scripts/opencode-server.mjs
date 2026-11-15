#!/usr/bin/env node
/**
 * Local OpenCode server for the opt-in agent scenario.
 *
 * `opencode serve` protects its API with HTTP basic auth and prints a random
 * password unless `OPENCODE_SERVER_PASSWORD` is set. Playwright starts this
 * wrapper as a second web server (`E2E_OPENCODE=1`), so the test can use a
 * fixed password and a fixed port.
 *
 *   node scripts/opencode-server.mjs            # serve until SIGINT/SIGTERM
 *   node scripts/opencode-server.mjs --check    # probe an already running server
 *
 * Environment: E2E_OPENCODE_PORT (4096), E2E_OPENCODE_HOST (127.0.0.1),
 * E2E_OPENCODE_USERNAME (opencode), E2E_OPENCODE_PASSWORD (e2e-local-password),
 * E2E_OPENCODE_PROJECT (results/opencode/project).
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = process.env.E2E_OPENCODE_HOST ?? "127.0.0.1";
const PORT = Number(process.env.E2E_OPENCODE_PORT ?? 4096);
const USERNAME = process.env.E2E_OPENCODE_USERNAME ?? "opencode";
const PASSWORD = process.env.E2E_OPENCODE_PASSWORD ?? "e2e-local-password";
const PROJECT_DIR = resolve(
  E2E_DIR,
  process.env.E2E_OPENCODE_PROJECT ?? join("results", "opencode", "project"),
);
const URL = `http://${HOST}:${PORT}`;
const CHECK = process.argv.includes("--check");
const ANSI = /\u001b\[[0-9;]*m/g;
const stripAnsi = (text) => String(text ?? "").replace(ANSI, "");

const authHeader = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64")}`;

function fail(message) {
  console.error(`✘ ${message}`);
  process.exit(2);
}

async function info() {
  const response = await fetch(`${URL}/api/info`, {
    headers: { Authorization: authHeader },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`/api/info responded with ${response.status}`);
  return response.json();
}

async function check() {
  try {
    const data = await info();
    console.log(
      `OpenCode server ready at ${URL} (version ${data?.version ?? "unknown"}, user ${USERNAME}).`,
    );
  } catch (error) {
    fail(
      `no reachable OpenCode server at ${URL}: ${stripAnsi(error?.message ?? error)}\n` +
        "  start one with: npm run opencode:serve",
    );
  }
}

async function waitForServer(child, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`opencode serve exited with code ${child.exitCode}`);
    }
    try {
      return await info();
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
    }
  }
  throw new Error(
    `opencode serve did not become ready within ${timeoutMs / 1000} s: ` +
      stripAnsi(lastError?.message ?? "unknown error"),
  );
}

async function serve() {
  try {
    execFileSync("opencode", ["--version"], { encoding: "utf8", timeout: 10_000 });
  } catch {
    fail('opencode is not on PATH. Install it first (see the e2e README).');
  }

  if (!existsSync(PROJECT_DIR)) mkdirSync(PROJECT_DIR, { recursive: true });

  let stopping = false;
  const child = spawn(
    "opencode",
    ["serve", "--hostname", HOST, "--port", String(PORT)],
    {
      cwd: PROJECT_DIR,
      env: { ...process.env, OPENCODE_SERVER_PASSWORD: PASSWORD },
      stdio: "inherit",
    },
  );

  const stop = (signal) => {
    stopping = true;
    if (child.exitCode === null) child.kill(signal);
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
  child.once("exit", (code, signal) => {
    process.exit(stopping ? 0 : code ?? (signal ? 1 : 0));
  });

  try {
    const data = await waitForServer(child);
    console.log(
      `OpenCode local server ready at ${URL} (version ${data?.version ?? "unknown"}).`,
    );
  } catch (error) {
    child.kill("SIGTERM");
    fail(stripAnsi(error?.message ?? error));
  }
}

if (CHECK) await check();
else await serve();
