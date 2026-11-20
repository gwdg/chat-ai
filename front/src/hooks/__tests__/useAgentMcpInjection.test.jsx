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
  it("moves the entries when another session is opened", async () => {
    // The registry is agent-wide, but the entries carry the session, so a switch hands them
    // over instead of leaving them available to the session that was open before.
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
        useAgentMcpInjection({
          agent: current,
          enabled,
          sessionId: current.sessionId,
        }),
      { initialProps: { current: agent, enabled: true } },
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(mocks.inject).toHaveBeenCalledTimes(1);
    expect(mocks.inject.mock.calls[0][2]).toMatchObject({
      sessionId: "session-1",
    });
    expect(result.current.injected).toHaveLength(1);

    rerender({
      current: { ...agent, sessionId: "session-2" },
      enabled: true,
    });
    await waitFor(() => expect(mocks.inject).toHaveBeenCalledTimes(2));
    expect(mocks.inject.mock.calls[1][2]).toMatchObject({
      sessionId: "session-2",
    });
    // The previous session's entries are removed by the reconcile itself, so switching does
    // not tear down every server first.
    expect(mocks.remove).not.toHaveBeenCalled();

    rerender({
      current: { ...agent, sessionId: "session-2" },
      enabled: false,
    });
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1));
    expect(result.current.status).toBe("off");
  });

  it("does nothing without a session, because the entry would be agent-wide", async () => {
    const { result } = renderHook(() =>
      useAgentMcpInjection({ agent, enabled: true, sessionId: "" }),
    );

    await waitFor(() => expect(result.current.status).toBe("off"));
    expect(mocks.inject).not.toHaveBeenCalled();
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
      ({ enabled }) =>
        useAgentMcpInjection({ agent, enabled, sessionId: agent.sessionId }),
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
