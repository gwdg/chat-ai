// Live test against a real `opencode serve` process.
//
// The unit tests beside this file stub `fetch`, so they pin the request shapes but
// cannot prove that a real OpenCode server accepts them. This file starts one on an
// ephemeral port, with a temporary HOME/XDG tree so it does not touch the user's
// OpenCode install, and drives the same client functions the app uses.
//
// Excluded from `npm test`: it spawns a server and belongs in `npm run test:live`.
// It skips itself when no `opencode` binary is installed (`OPENCODE_BIN` overrides
// the lookup). It never prompts a model, so it needs no credentials and no network.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createOpencodeSession,
  deleteOpencodeSession,
  getOpencodeInfo,
  getOpencodeSession,
  getOpencodeSessionStatus,
  listOpencodeAgents,
  listOpencodeCommands,
  listOpencodeFiles,
  listOpencodeMessages,
  listOpencodeModels,
  listOpencodeSessions,
  readOpencodeFile,
  renameOpencodeSession,
  runOpencodeShellAndWait,
  subscribeOpencodeEvents,
  writeOpencodeFile,
} from "../opencodeAgents";

const BINARY = process.env.OPENCODE_BIN || "opencode";
const PASSWORD = "chat-ai-live-test";
const READY_TIMEOUT_MS = 45000;

// A skipped suite is the normal case on a machine without OpenCode; failing there
// would make the live check useless in CI and on contributor laptops.
const hasOpencode = () => {
  try {
    return spawnSync(BINARY, ["--version"], { encoding: "utf8" }).status === 0;
  } catch {
    return false;
  }
};

const live = hasOpencode() ? describe : describe.skip;

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const basicAuth = (password) =>
  `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`;

live("opencodeAgents against a real opencode serve", () => {
  let child;
  let root;
  let base;
  let port;
  let stderr = "";
  const agent = {
    id: "live-agent",
    name: "Live agent",
    username: "opencode",
    password: PASSWORD,
  };

  const start = async () => {
    port = await freePort();
    base = `http://127.0.0.1:${port}`;
    // Isolate the server's state. OpenCode writes projects, sessions and plugin
    // caches below HOME/XDG, and a live test must not add entries to the user's own.
    root = mkdtempSync(path.join(os.tmpdir(), "chatai-opencode-live-"));
    const workdir = path.join(root, "work");
    // OpenCode serves the current directory as the project, so it has to exist before
    // the process starts; it also keeps the test files out of the repository.
    mkdirSync(workdir, { recursive: true });
    const env = {
      ...process.env,
      HOME: root,
      XDG_CONFIG_HOME: path.join(root, "config"),
      XDG_DATA_HOME: path.join(root, "data"),
      XDG_CACHE_HOME: path.join(root, "cache"),
      XDG_STATE_HOME: path.join(root, "state"),
      // The same variable the agent service uses for a per-agent backend. With it set,
      // the API answers 401 without basic auth, which is what the client sends.
      OPENCODE_SERVER_PASSWORD: PASSWORD,
      NO_COLOR: "1",
    };
    child = spawn(
      BINARY,
      ["serve", "--hostname", "127.0.0.1", "--port", String(port)],
      { cwd: workdir, env, stdio: ["ignore", "pipe", "pipe"] },
    );
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    // Drain stdout: an unread pipe fills and blocks the server.
    child.stdout.resume();
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`opencode serve exited (${child.exitCode}): ${stderr}`);
      }
      try {
        const response = await fetch(`${base}/api/info`, {
          headers: { Authorization: basicAuth(PASSWORD) },
        });
        if (response.ok) return response.json();
      } catch {
        // Still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`opencode serve did not become ready: ${stderr}`);
  };

  beforeAll(async () => {
    await start();
    agent.serverUrl = base;
  }, READY_TIMEOUT_MS + 15000);

  afterAll(async () => {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 5000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    if (child) {
      // A killed OpenCode can leave a backend child behind; it belongs to this test only.
      spawnSync("pkill", [
        "-f",
        `opencode serve --hostname 127.0.0.1 --port ${port}`,
      ]);
    }
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("reports the server it started", async () => {
    const info = await getOpencodeInfo(agent);

    expect(typeof info.version).toBe("string");
    expect(info.version.length).toBeGreaterThan(0);
    expect(info.urls).toContain(base);
  });

  it("rejects a wrong password instead of treating it as a missing server", async () => {
    // The add-agent dialog tells "wrong password" apart from "unreachable", so the
    // client must surface OpenCode's 401 as its own message.
    await expect(
      getOpencodeInfo({ ...agent, password: "wrong-password" }),
    ).rejects.toThrow("The opencode server rejected the password.");
  });

  it("creates, lists, renames and deletes a session", async () => {
    const created = await createOpencodeSession(agent, "live session");
    expect(created.id).toMatch(/^ses_/);
    expect(created.title).toBe("live session");

    const listed = await listOpencodeSessions(agent);
    expect(listed.map((session) => session.id)).toContain(created.id);

    await renameOpencodeSession(agent, created.id, "renamed live session");
    const read = await getOpencodeSession(agent, created.id);
    expect(read.title).toBe("renamed live session");

    // Status is a control call the sidebar polls; it must not throw on a fresh server.
    expect(await getOpencodeSessionStatus(agent)).toBeTypeOf("object");

    await deleteOpencodeSession(agent, created.id);
    const afterDelete = await listOpencodeSessions(agent);
    expect(afterDelete.map((session) => session.id)).not.toContain(created.id);
  });

  it("writes a file through the API and reads it back", async () => {
    // `/fs/list` and `/fs/read` are what the agent file panel shows; the write goes
    // through the same route the panel uses for uploads and new files.
    await writeOpencodeFile(agent, "notes.txt", "live workspace content");

    const files = await listOpencodeFiles(agent);
    expect(files.map((entry) => entry.path)).toContain("notes.txt");

    const { blob, type } = await readOpencodeFile(agent, "notes.txt");
    expect(await blob.text()).toBe("live workspace content");
    expect(type).toContain("text/");

    // Proof that the bytes reached the real filesystem, not just a response body.
    expect(readFileSync(path.join(root, "work", "notes.txt"), "utf8")).toBe(
      "live workspace content",
    );
  });

  it("lists the model, agent and command catalogues", async () => {
    const [models, agents, commands] = await Promise.all([
      listOpencodeModels(agent),
      listOpencodeAgents(agent),
      listOpencodeCommands(agent),
    ]);

    expect(Array.isArray(models)).toBe(true);
    expect(agents.length).toBeGreaterThan(0);
    expect(agents[0]).toHaveProperty("id");
    expect(commands.length).toBeGreaterThan(0);
  });

  it(
    "runs a shell command and reads its output from the session history",
    async () => {
      const session = await createOpencodeSession(agent, "shell session");

      // This subscribes to `/api/event` first and waits for `session.shell.ended`, so it
      // covers the SSE parser as well as the shell endpoint.
      const output = await runOpencodeShellAndWait(
        agent,
        session.id,
        "echo live-opencode-ok",
      );
      expect(output).toContain("live-opencode-ok");

      const messages = await listOpencodeMessages(agent, session.id);
      const shell = messages.find((message) => message.type === "shell");
      expect(shell.command).toBe("echo live-opencode-ok");
      expect(shell.output.output).toContain("live-opencode-ok");

      await deleteOpencodeSession(agent, session.id);
    },
    30000,
  );

  it(
    "streams server events and stops when the subscription is aborted",
    async () => {
      const controller = new AbortController();
      const events = [];
      let markCreated;
      let markConnected;
      const created = new Promise((resolve) => {
        markCreated = resolve;
      });
      const connected = new Promise((resolve) => {
        markConnected = resolve;
      });
      const stream = subscribeOpencodeEvents(
        agent,
        (event) => {
          events.push(event);
          if (event?.type === "server.connected") markConnected();
          if (event?.type === "session.created") markCreated(event);
        },
        controller.signal,
      );

      // Wait for the stream itself before triggering an event; otherwise the server can
      // broadcast `session.created` before this client is listening.
      await connected;

      const session = await createOpencodeSession(agent, "event session");
      await expect(created).resolves.toMatchObject({ type: "session.created" });

      controller.abort();
      await expect(stream).resolves.toBeUndefined();
      expect(events.some((event) => event?.type === "server.connected")).toBe(
        true,
      );

      await deleteOpencodeSession(agent, session.id);
    },
    20000,
  );

  it("fails loudly when the password is missing", async () => {
    // A service backend always gets a generated password; a config that drops it must
    // not read the API unauthenticated, which is what an empty header would do.
    await expect(getOpencodeInfo({ ...agent, password: "" })).rejects.toThrow(
      "The opencode server rejected the password.",
    );
  });
});
