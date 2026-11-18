import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notifyError: vi.fn(),
  settings: { mcp_servers: [] },
}));

vi.mock("../useToast", () => ({
  useToast: () => ({ notifyError: mocks.notifyError }),
}));
vi.mock("react-redux", () => ({
  useSelector: () => mocks.settings,
}));
vi.mock("../../apis/opencodeAgents", () => ({
  addOpencodeMcpServer: vi.fn(async () => {}),
  connectOpencodeMcpServer: vi.fn(async () => {}),
  removeOpencodeMcpServer: vi.fn(async () => {}),
}));

import { bridgeBaseFor, useAgentBridge, wantsSidecar } from "../useAgentBridge";

const props = {
  agent: { id: "agent-1", name: "Example agent" },
  workspaceId: "ws-1",
  writable: false,
  mcp: false,
  mounts: [],
  providers: new Map(),
  rootProvider: null,
};

const sessionResponse = {
  id: "session-1",
  token: "browser-token",
  agentToken: "agent-token",
  runId: "session-1",
  wsUrl: "/agents/svc-1/bridge/ws?id=session-1&token=browser-token",
  agentWsUrl: "ws://agent-service.test/agents/svc-1/bridge/agent?id=session-1&token=agent-token",
  mcpUrl: "http://agent-service.test/agents/svc-1/bridge/mcp/session-1",
};

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send() {}
  close() {}
}

const respond = (status: number) =>
  vi.fn(async () => ({ ok: status < 400, status, json: async () => ({}) }));

const respondWithSession = () =>
  vi.fn(async () => ({ ok: true, status: 200, json: async () => sessionResponse }));

afterEach(() => {
  vi.unstubAllGlobals();
  mocks.notifyError.mockReset();
  FakeWebSocket.instances = [];
});

describe("useAgentBridge", () => {
  it("reports a deployment without the bridge route as unavailable", async () => {
    // A direct engine endpoint answers the configured backend with 404.
    const fetchMock = respond(404);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAgentBridge(props));

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.unavailable).toBe(true);
    expect(result.current.error).toContain("/bridge/sessions");
    expect(result.current.error).toContain("404");
    expect(mocks.notifyError).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${window.location.origin}/bridge/sessions`,
    );
  });

  it("forgets an unavailable deployment once nothing is exposed any more", async () => {
    // Detaching the last workspace must not leave a red "not available" behind: with no
    // workspace there is no bridge to report on at all.
    vi.stubGlobal("fetch", respond(404));

    const { result, rerender } = renderHook(
      ({ workspaceId }: { workspaceId: string | null }) =>
        useAgentBridge({ ...props, workspaceId }),
      { initialProps: { workspaceId: "ws-1" } },
    );

    await waitFor(() => expect(result.current.unavailable).toBe(true));

    rerender({ workspaceId: null });

    await waitFor(() => expect(result.current.status).toBe("off"));
    expect(result.current.unavailable).toBe(false);
    expect(result.current.error).toBe("");
  });

  it("keeps the local sidecar away from service-managed agents", () => {
    // The sidecar command is a path in the user's OpenCode install. A service agent runs
    // OpenCode inside the agent service, which uses the HTTP fallback (mcpUrl) instead.
    const command = ["/usr/bin/node", "/opt/chat-ai/bridge-sidecar.mjs"];

    expect(wantsSidecar(command, { id: "local-1" })).toBe(true);
    expect(
      wantsSidecar(command, { id: "local-1", serviceAgentId: "svc-1" }),
    ).toBe(false);
    expect(wantsSidecar(null, { id: "local-1" })).toBe(false);
  });

  it("routes the session call to back for a local agent and to the service for a SAIA agent", () => {
    // Local agents talk to back at the backend root; a service-managed agent uses the
    // service prefix on the page origin, so a changed deployment cannot pin it elsewhere.
    expect(bridgeBaseFor({ id: "local-1" }, "http://localhost:8081")).toBe(
      "http://localhost:8081",
    );
    expect(
      bridgeBaseFor(
        { id: "local-1", serviceAgentId: "svc-1" },
        "http://localhost:8081",
      ),
    ).toBe("/agents/svc-1");
    expect(bridgeBaseFor({ id: "local-1" }, "")).toBe(window.location.origin);
  });

  it("keeps other failures as a broken bridge", async () => {
    vi.stubGlobal("fetch", respond(500));

    const { result } = renderHook(() => useAgentBridge(props));

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.unavailable).toBe(false);
    expect(result.current.error).toBe("Bridge session failed (500)");
  });

  it("uses the agent service and resolves the returned socket path", async () => {
    // A service-managed agent is served by the SAIA agent service on the app's
    // own origin; its browser URL is a path, so the page origin completes it.
    const fetchMock = respondWithSession();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("WebSocket", FakeWebSocket);

    const { result } = renderHook(() =>
      useAgentBridge({
        ...props,
        agent: { id: "local-1", serviceAgentId: "svc-1" },
      }),
    );

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/agents/svc-1/bridge/sessions",
    );
    expect(FakeWebSocket.instances[0].url).toBe(
      `ws://${window.location.host}${sessionResponse.wsUrl}`,
    );
    expect(result.current.status).toBe("connecting");
  });
});
