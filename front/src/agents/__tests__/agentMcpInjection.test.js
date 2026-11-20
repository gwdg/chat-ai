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
  injectableMcpServers,
  injectExternalMcpServers,
  injectedMcpName,
  injectedMcpNames,
  removeInjectedMcpServers,
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
