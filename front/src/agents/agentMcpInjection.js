import {
  addOpencodeMcpServer,
  connectOpencodeMcpServer,
  listOpencodeMcpServers,
  removeOpencodeMcpServer,
} from "../apis/opencodeAgents";
import { normalizeMcpUrl } from "../agent/mcp";

/**
 * Natively injected MCP servers carry this prefix, so a later run can recognise and remove
 * entries this app owns without touching the bridge's own server or the user's manual ones.
 */
export const INJECTED_MCP_PREFIX = "chatai-ext-";

/**
 * OpenCode's `/api/mcp` reports `{status: {status, error?}}`; older releases used a plain
 * string. Both are read here so no caller has to print `[object Object]`.
 */
export const mcpServerStatus = (server) => {
  const status = server?.status;
  if (typeof status === "string") return status;
  return typeof status?.status === "string" ? status.status : "";
};

export const mcpServerStatusError = (server) => {
  const status = server?.status;
  return typeof status?.error === "string" ? status.error : "";
};

const hasHeaders = (server) =>
  !!server?.headers &&
  typeof server.headers === "object" &&
  Object.keys(server.headers).length > 0;

/**
 * The MCP servers OpenCode may connect itself: a global server with an HTTP URL and no stored
 * headers. The configured kind plays no part — an entry with an address is a server OpenCode can
 * dial, while a SAIA-gateway entry has only an id and answers through the gateway. A header means
 * a password or token, which only the browser may hold, so such a server stays on the relay.
 * A URL that does not parse cannot be handed over either.
 */
export function injectableMcpServers(servers = []) {
  const seen = new Set();
  const result = [];
  for (const server of Array.isArray(servers) ? servers : []) {
    if (hasHeaders(server)) continue;
    const url = normalizeMcpUrl(server.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push({
      id: typeof server.id === "string" ? server.id : url,
      name: server.name || url,
      url,
    });
  }
  return result;
}

const slugify = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

/**
 * The OpenCode name of an injected server.
 *
 * `<prefix><server>-<session>`: the server part identifies the entry for a human, and the
 * trailing session id is what `agents/agentMcpScope.js` reads to decide which session may use
 * it. The session id is required — an entry without one would belong to every session of the
 * agent — and the name follows a rename, since the old entry is removed on the next run.
 */
export function injectedMcpName(server, sessionId, index = 1) {
  const url = normalizeMcpUrl(server?.url) || String(server?.url ?? "");
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = "";
  }
  const label = slugify(server?.name) || slugify(host) || "server";
  // The counter sits before the session id, which must stay the end of the name: that is what
  // `agentMcpScope.js` reads to decide the owner.
  const counter = index > 1 ? `-${index}` : "";
  return `${INJECTED_MCP_PREFIX}${label}${counter}-${sessionId}`;
}

/**
 * Name every candidate for one session, keeping two servers with the same display name apart.
 *
 * The order of the settings array decides which one keeps the plain name, so the same input
 * always produces the same mapping and a later run recognises its own entries.
 */
export function injectedMcpNames(servers = [], sessionId) {
  const used = new Set();
  const names = new Map();
  for (const server of servers) {
    let index = 1;
    let name = injectedMcpName(server, sessionId, index);
    while (used.has(name)) {
      index += 1;
      name = injectedMcpName(server, sessionId, index);
    }
    used.add(name);
    names.set(name, server);
  }
  return names;
}

const isInjectedName = (name) =>
  typeof name === "string" && name.startsWith(INJECTED_MCP_PREFIX);

const defaultWait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll `/api/mcp` until the server reaches a terminal state.
 *
 * OpenCode answers `pending` while it connects and switches to `connected` or `failed` on its
 * own (a refused or timed-out server becomes `failed` after about eight seconds). A `pending`
 * result after the last attempt is returned as it is, and the caller removes it: leaving an
 * unconfirmed entry would keep the server in both routes.
 */
async function waitForMcpStatus(agent, name, options = {}) {
  const attempts =
    Number.isFinite(options.attempts) && options.attempts > 0
      ? options.attempts
      : 12;
  const delay =
    Number.isFinite(options.delay) && options.delay >= 0 ? options.delay : 1000;
  const wait = typeof options.wait === "function" ? options.wait : defaultWait;
  const cancelled = typeof options.isCancelled === "function"
    ? options.isCancelled
    : () => false;
  let entry = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (cancelled()) return entry;
    const servers = await listOpencodeMcpServers(agent);
    entry = servers.find((server) => server?.name === name) ?? null;
    const status = mcpServerStatus(entry);
    if (status === "connected" || status === "failed") return entry;
    if (attempt < attempts - 1) await wait(delay);
  }
  return entry;
}

/**
 * Reconcile the natively injected MCP servers of one agent for one session.
 *
 * Every candidate is added to OpenCode and connected. One that ends up `connected` is reported
 * as injected, so the bridge no longer relays it; one that fails (not reachable from the
 * OpenCode host, or still pending after the timeout) is removed again and reported as failed,
 * which leaves it to the bridge relay. Entries from an earlier run that no longer match a
 * candidate are deleted, so a removed or changed server does not linger — including the entries
 * of every other session, because the registry is agent-wide and only one session may own them
 * (`agents/agentMcpScope.js` then restricts them to this one).
 *
 * OpenCode's `/experimental/mcp` API is runtime-only (nothing is written to disk), so this has
 * to run again after the agent's OpenCode restarts, and again whenever the session changes.
 */
export async function injectExternalMcpServers(
  agent,
  servers,
  options = {},
) {
  const sessionId = options.sessionId ?? agent?.sessionId ?? "";
  if (!sessionId) {
    // Without a session id the entry would be visible to every session, which is exactly what
    // this function must not do.
    return { injected: [], failed: [], removed: [] };
  }
  const candidates = injectableMcpServers(servers);
  const desired = injectedMcpNames(candidates, sessionId);
  const existing = await listOpencodeMcpServers(agent);
  const owned = existing.filter((server) => isInjectedName(server?.name));

  const removed = [];
  for (const server of owned) {
    if (desired.has(server.name)) continue;
    await removeOpencodeMcpServer(agent, server.name).catch(() => {});
    removed.push(server.name);
  }

  const known = new Map(
    owned
      .filter((server) => desired.has(server.name))
      .map((server) => [server.name, server]),
  );
  const cancelled = typeof options.isCancelled === "function"
    ? options.isCancelled
    : () => false;
  const injected = [];
  const failed = [];

  for (const [name, server] of desired) {
    if (cancelled()) break;
    try {
      let entry = known.get(name);
      if (!entry) {
        await addOpencodeMcpServer(agent, name, {
          type: "remote",
          url: server.url,
          // Kept off so each tool is a real tool with its own `<server>_<tool>` action, which is
          // what the per-session permission rules can deny; Code Mode would hide them behind a
          // single `execute` tool.
          codemode: false,
        });
        await connectOpencodeMcpServer(agent, name);
        entry = { name, status: { status: "pending" } };
      } else if (mcpServerStatus(entry) !== "connected") {
        await connectOpencodeMcpServer(agent, name);
      }
      if (mcpServerStatus(entry) !== "connected") {
        entry = await waitForMcpStatus(agent, name, options);
      }
      if (mcpServerStatus(entry) === "connected") {
        injected.push({ ...server, entryName: name });
        continue;
      }
      // Not reachable from the OpenCode host: drop the entry so the bridge relay owns this
      // server instead of showing a broken one in OpenCode.
      await removeOpencodeMcpServer(agent, name).catch(() => {});
      failed.push({
        ...server,
        entryName: name,
        error:
          mcpServerStatusError(entry) ||
          (mcpServerStatus(entry) === "pending"
            ? "Connection timed out"
            : "Could not connect"),
      });
    } catch (reason) {
      await removeOpencodeMcpServer(agent, name).catch(() => {});
      failed.push({
        ...server,
        entryName: name,
        error: reason instanceof Error ? reason.message : String(reason),
      });
    }
  }

  return { injected, failed, removed };
}

/**
 * Remove every natively injected server this app owns. Called when the option is switched off
 * so those servers fall back to the bridge relay.
 */
export async function removeInjectedMcpServers(agent) {
  const existing = await listOpencodeMcpServers(agent).catch(() => []);
  const owned = existing.filter((server) => isInjectedName(server?.name));
  for (const server of owned) {
    await removeOpencodeMcpServer(agent, server.name).catch(() => {});
  }
  return owned.map((server) => server.name);
}
