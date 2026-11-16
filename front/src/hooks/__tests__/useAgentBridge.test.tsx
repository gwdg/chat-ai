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

import { useAgentBridge } from "../useAgentBridge";

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
