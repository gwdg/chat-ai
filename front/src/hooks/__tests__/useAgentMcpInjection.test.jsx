import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settings: { mcp_servers: [] },
  inject: vi.fn(async () => ({ injected: [], failed: [], removed: [] })),
  remove: vi.fn(async () => []),
}));

vi.mock("react-redux", () => ({
  useSelector: () => mocks.settings,
}));
vi.mock("../../agents/agentMcpInjection", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    injectExternalMcpServers: (...args) => mocks.inject(...args),
    removeInjectedMcpServers: (...args) => mocks.remove(...args),
  };
});

import { useAgentMcpInjection } from "../useAgentMcpInjection";

const agent = {
  id: "agent-1",
  name: "Example agent",
  sessionId: "session-1",
  serviceAgentId: "svc-1",
};

beforeEach(() => {
  mocks.settings = { mcp_servers: [] };
  mocks.inject.mockClear();
  mocks.remove.mockClear();
});

describe("useAgentMcpInjection", () => {
  it("runs for the agent, not for each session", async () => {
    // The MCP registry belongs to the agent's OpenCode, so a session switch (which only
    // moves `sessionId`) must not remove and re-add the servers.
    mocks.settings = {
      mcp_servers: [
        {
          id: "search",
          name: "Search",
          kind: "local",
          url: "http://search.test/mcp",
        },
      ],
    };
    mocks.inject.mockResolvedValue({
      injected: [{ id: "search", name: "Search", url: "http://search.test/mcp" }],
      failed: [],
      removed: [],
    });

    const { result, rerender } = renderHook(
      ({ current, enabled }) =>
        useAgentMcpInjection({ agent: current, enabled }),
      { initialProps: { current: agent, enabled: true } },
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(mocks.inject).toHaveBeenCalledTimes(1);
    expect(result.current.injected).toHaveLength(1);

    rerender({ current: { ...agent, sessionId: "session-2" }, enabled: true });
    expect(mocks.inject).toHaveBeenCalledTimes(1);
    expect(mocks.remove).not.toHaveBeenCalled();

    rerender({ current: { ...agent, sessionId: "session-2" }, enabled: false });
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1));
    expect(result.current.status).toBe("off");
  });

  it("reconciles again when the configured servers change", async () => {
    mocks.settings = {
      mcp_servers: [
        {
          id: "search",
          name: "Search",
          kind: "local",
          url: "http://search.test/mcp",
        },
      ],
    };

    const { rerender } = renderHook(
      ({ enabled }) => useAgentMcpInjection({ agent, enabled }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => expect(mocks.inject).toHaveBeenCalledTimes(1));


    mocks.settings = {
      mcp_servers: [
        {
          id: "search",
          name: "Search",
          kind: "local",
          url: "http://search.test/mcp",
        },
        {
          id: "docs",
          name: "Docs",
          kind: "local",
          url: "http://docs.test/mcp",
        },
      ],
    };
    rerender({ enabled: true });

    await waitFor(() => expect(mocks.inject).toHaveBeenCalledTimes(2));
  });
});
