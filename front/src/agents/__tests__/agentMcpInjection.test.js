import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(async () => []),
  add: vi.fn(async () => {}),
  connect: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
}));

vi.mock("../../apis/opencodeAgents", () => ({
  listOpencodeMcpServers: (...args) => mocks.list(...args),
  addOpencodeMcpServer: (...args) => mocks.add(...args),
  connectOpencodeMcpServer: (...args) => mocks.connect(...args),
  removeOpencodeMcpServer: (...args) => mocks.remove(...args),
}));

import {
  INJECTED_MCP_PREFIX,
  WRAPPED_MCP_PREFIX,
  injectableMcpServers,
  injectExternalMcpServers,
  injectedMcpName,
  injectedMcpNames,
  relayedMcpServers,
  removeInjectedMcpServers,
  sweepStaleWrappedEntries,
  wrappedMcpName,
  wrappedMcpNames,
  wrappedMcpServers,
} from "../agentMcpInjection";

const agent = { id: "agent-1", name: "Example agent" };
const sessionId = "ses_alpha";

const servers = [
  { id: "web", name: "Web search", kind: "local", url: "http://search.test/mcp" },
  {
    id: "auth",
    name: "Authorized",
    kind: "local",
    url: "http://auth.test/mcp",
    headers: { Authorization: "Bearer secret" },
  },
  { id: "gateway", name: "GWDG", kind: "remote", serverId: "gw-1" },
  {
    id: "public-gateway",
    name: "Public gateway server",
    kind: "remote",
    url: "https://gateway.test/servers/public/mcp",
  },
];

beforeEach(() => {
  mocks.list.mockReset();
  mocks.list.mockResolvedValue([]);
  mocks.add.mockReset();
  mocks.connect.mockReset();
  mocks.remove.mockReset();
});

describe("agent MCP injection", () => {
  it("treats every server with an address the same and skips password-protected ones", () => {
    // The configured kind is not a routing decision: a gateway entry with a URL is as
    // injectable as a local one, and a gateway entry with only an id has nothing to dial.
    const candidates = injectableMcpServers(servers);

    expect(candidates.map((server) => server.id)).toEqual([
      "web",
      "public-gateway",
    ]);
    expect(candidates[0].url).toBe("http://search.test/mcp");
    expect(candidates[1].id).toBe("public-gateway");
  });

  it("normalizes a bare host and rejects a value that is not an address", () => {
    const candidates = injectableMcpServers([
      { id: "bare", kind: "local", url: "localhost:9000/mcp" },
      { id: "invalid", kind: "local", url: "not a host" },
      { id: "empty", kind: "local", url: "" },
      { id: "blank-headers", kind: "local", url: "http://ok.test/mcp", headers: {} },
    ]);

    expect(candidates.map((server) => server.url)).toEqual([
      "http://localhost:9000/mcp",
      "http://ok.test/mcp",
    ]);
  });

  it("counts what stays on the relay, headers included and injected servers excluded", () => {
    // The two routes are mutually exclusive per server: an entry OpenCode connected is no
    // longer relayed, while a password-protected one always is. A gateway entry with only an
    // id has no address to relay.
    const relayed = relayedMcpServers(servers, [
      { url: "http://search.test/mcp" },
    ]);

    expect(relayed.map((server) => server.id)).toEqual([
      "auth",
      "public-gateway",
    ]);
    expect(relayed[0].url).toBe("http://auth.test/mcp");
  });

  it("does not count the same address twice", () => {
    const relayed = relayedMcpServers([
      { id: "one", url: "http://same.test/mcp" },
      { id: "two", url: "http://same.test/mcp" },
    ]);

    expect(relayed).toHaveLength(1);
  });

  it("names an entry after the server and ends it with the session id", () => {
    const name = injectedMcpName(
      { name: "Web search", url: "http://search.test/mcp" },
      sessionId,
    );

    // The scope reads the trailing session id; a name that ends anywhere else would belong to
    // every session again.
    expect(name).toBe(`${INJECTED_MCP_PREFIX}web-search-${sessionId}`);
    expect(name.endsWith(sessionId)).toBe(true);
  });

  it("falls back to the URL host and keeps same-named servers apart", () => {
    expect(
      injectedMcpName({ url: "http://search.test/mcp" }, sessionId),
    ).toBe(`${INJECTED_MCP_PREFIX}search-test-${sessionId}`);

    const names = injectedMcpNames(
      [
        { id: "one", name: "Same", url: "http://one.test/mcp" },
        { id: "two", name: "Same", url: "http://two.test/mcp" },
      ],
      sessionId,
    );

    expect([...names.keys()]).toEqual([
      `${INJECTED_MCP_PREFIX}same-${sessionId}`,
      `${INJECTED_MCP_PREFIX}same-2-${sessionId}`,
    ]);
  });

  it("keeps the servers OpenCode connected and hands the rest back to the bridge", async () => {
    // The fake OpenCode settles each connection in `wait`: one becomes connected, the other
    // fails like an address only the browser can reach.
    const entries = new Map();
    mocks.list.mockImplementation(async () => [...entries.values()]);
    mocks.add.mockImplementation(async (_agent, name, config) => {
      entries.set(name, { name, config, status: { status: "pending" } });
    });
    mocks.remove.mockImplementation(async (_agent, name) => {
      entries.delete(name);
      return true;
    });
    const wait = vi.fn(async () => {
      for (const entry of entries.values()) {
        if (entry.status.status !== "pending") continue;
        entry.status = entry.config.url.includes("reachable")
          ? { status: "connected" }
          : { status: "failed", error: "ECONNREFUSED" };
      }
    });

    const result = await injectExternalMcpServers(
      agent,
      [
        { id: "up", name: "Up", kind: "local", url: "http://reachable.test/mcp" },
        { id: "down", name: "Down", kind: "local", url: "http://blocked.test/mcp" },
      ],
      { sessionId, wait, delay: 0, attempts: 3 },
    );

    expect(result.injected.map((server) => server.id)).toEqual(["up"]);
    expect(result.failed).toEqual([
      expect.objectContaining({ id: "down", error: "ECONNREFUSED" }),
    ]);
    // Every entry belongs to the session it was added for, and each tool stays a tool of its
    // own so the session rules can deny it (Code Mode would hide it behind `execute`).
    expect(result.injected[0].entryName).toBe(
      `${INJECTED_MCP_PREFIX}up-${sessionId}`,
    );
    expect(mocks.add).toHaveBeenCalledWith(agent, result.injected[0].entryName, {
      type: "remote",
      url: "http://reachable.test/mcp",
      codemode: false,
    });
    // The failed entry is removed again; leaving it in OpenCode would show a broken server
    // next to the bridge relay that can actually reach it.
    expect(entries.has(result.failed[0].entryName)).toBe(false);
    expect(mocks.remove).toHaveBeenCalledWith(
      agent,
      result.failed[0].entryName,
    );
  });

  it("does nothing without a session, because an unnamed entry is agent-wide", async () => {
    const result = await injectExternalMcpServers(agent, servers, {});

    expect(result).toEqual({ injected: [], failed: [], removed: [] });
    expect(mocks.add).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("reuses a connected entry and removes stale injected ones", async () => {
    const up = {
      id: "up",
      name: "Up",
      kind: "local",
      url: "http://reachable.test/mcp",
    };
    const kept = {
      name: injectedMcpName(up, sessionId),
      status: { status: "connected" },
    };
    const stale = {
      name: `${INJECTED_MCP_PREFIX}gone-000000`,
      status: { status: "connected" },
    };
    mocks.list.mockResolvedValue([
      kept,
      stale,
      { name: "chatai-bridge-1234", status: { status: "connected" } },
      { name: "manual", status: { status: "connected" } },
    ]);

    const result = await injectExternalMcpServers(agent, [up], {
      sessionId,
      wait: async () => {},
      delay: 0,
      attempts: 1,
    });

    expect(result.injected.map((server) => server.url)).toEqual([up.url]);
    expect(mocks.add).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledWith(agent, stale.name);
  });

  it("moves the entries to the session that is open now", async () => {
    // The registry is agent-wide: the entries of the session opened before have to go, or that
    // session would keep the servers it was never given again.
    const up = {
      id: "up",
      name: "Up",
      kind: "local",
      url: "http://reachable.test/mcp",
    };
    const previous = {
      name: injectedMcpName(up, "ses_previous"),
      status: { status: "connected" },
    };
    mocks.list.mockResolvedValue([previous]);

    const result = await injectExternalMcpServers(agent, [up], {
      sessionId,
      wait: async () => {},
      delay: 0,
      attempts: 1,
    });

    expect(mocks.remove).toHaveBeenCalledWith(agent, previous.name);
    expect(result.removed).toEqual([previous.name]);
    expect(mocks.add).toHaveBeenCalledWith(
      agent,
      `${INJECTED_MCP_PREFIX}up-${sessionId}`,
      expect.objectContaining({ url: up.url }),
    );
  });

  it("removes only the entries this app injected", async () => {
    mocks.list.mockResolvedValue([
      { name: `${INJECTED_MCP_PREFIX}one-ses_a` },
      { name: `${INJECTED_MCP_PREFIX}two-ses_b` },
      { name: "chatai-bridge-1234" },
      { name: "manual" },
    ]);

    const removed = await removeInjectedMcpServers(agent);

    expect(removed).toHaveLength(2);
    expect(mocks.remove.mock.calls.map(([, name]) => name)).toEqual(removed);
  });
});

describe("authenticated MCP servers as stdio proxies", () => {
  // The token is the reason for wrapping: it may stay in the browser, so OpenCode gets a local
  // entry that asks this page to run the call instead of a `remote` entry with headers.
  const authenticated = [
    {
      id: "auth",
      name: "Authorized",
      url: "http://auth.test/mcp",
      headers: { Authorization: "Bearer secret" },
    },
    {
      id: "twin",
      name: "Twin",
      url: "http://twin.test/mcp",
      headers: { "x-api-key": "k" },
    },
  ];

  it("wraps exactly the servers that carry a header", () => {
    const wrapped = wrappedMcpServers([
      ...authenticated,
      { id: "plain", name: "Plain", url: "http://plain.test/mcp" },
      { id: "gateway", name: "GWDG", serverId: "gw-1" },
      // A header with no keys is not a credential, and a URL that does not parse cannot be
      // proxied either.
      { id: "empty", name: "Empty", url: "http://empty.test/mcp", headers: {} },
      { id: "broken", name: "Broken", url: ":::", headers: { "x-api-key": "k" } },
    ]);

    expect(wrapped.map((server) => server.id)).toEqual(["auth", "twin"]);
    // The id travels to the agent, not the address or the header: the browser resolves it
    // against the current settings, so an edited token needs no re-registration.
    expect(wrapped[0]).toEqual({
      id: "auth",
      name: "Authorized",
      url: "http://auth.test/mcp",
      headers: { Authorization: "Bearer secret" },
    });
  });

  it("does not wrap the same address twice", () => {
    expect(
      wrappedMcpServers([
        { id: "one", url: "http://same.test/mcp", headers: { a: "1" } },
        { id: "two", url: "http://same.test/mcp", headers: { a: "2" } },
      ]).map((server) => server.id),
    ).toEqual(["one"]);
  });

  it("names the entry after the server and ends it with the session id", () => {
    const name = wrappedMcpName(
      { name: "Authorized", url: "http://auth.test/mcp" },
      sessionId,
    );

    expect(name).toBe(`${WRAPPED_MCP_PREFIX}authorized-${sessionId}`);
    // The session scope reads the trailing id; a name that ended anywhere else would be
    // offered to every session of the agent again.
    expect(name.endsWith(sessionId)).toBe(true);

    const names = wrappedMcpNames(authenticated, sessionId);
    expect([...names.keys()]).toEqual([
      `${WRAPPED_MCP_PREFIX}authorized-${sessionId}`,
      `${WRAPPED_MCP_PREFIX}twin-${sessionId}`,
    ]);
  });

  it("keeps two same-named proxies apart with a counter before the session", () => {
    const names = wrappedMcpNames(
      [
        { id: "one", name: "Same", url: "http://one.test/mcp" },
        { id: "two", name: "Same", url: "http://two.test/mcp" },
      ],
      sessionId,
    );

    expect([...names.keys()]).toEqual([
      `${WRAPPED_MCP_PREFIX}same-${sessionId}`,
      `${WRAPPED_MCP_PREFIX}same-2-${sessionId}`,
    ]);
  });

  it("sweeps the proxies of sessions that are no longer open and leaves the rest", async () => {
    mocks.list.mockResolvedValue([
      { name: `${WRAPPED_MCP_PREFIX}authorized-ses_previous` },
      { name: `${INJECTED_MCP_PREFIX}up-ses_previous` },
      { name: "chatai-bridge-ses_previous" },
      { name: "manual" },
    ]);

    const keep = new Set([`${WRAPPED_MCP_PREFIX}authorized-${sessionId}`]);
    const removed = await sweepStaleWrappedEntries(agent, keep);

    expect(removed).toEqual([`${WRAPPED_MCP_PREFIX}authorized-ses_previous`]);
    // Only our own proxies: injected entries and the bridge entry have their own sweep.
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledWith(
      agent,
      `${WRAPPED_MCP_PREFIX}authorized-ses_previous`,
    );
  });

  it("a sweep of the session's own proxies removes nothing", async () => {
    const name = `${WRAPPED_MCP_PREFIX}authorized-${sessionId}`;
    mocks.list.mockResolvedValue([{ name }]);

    expect(await sweepStaleWrappedEntries(agent, new Set([name]))).toEqual([]);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
