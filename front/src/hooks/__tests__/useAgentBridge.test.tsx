import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notifyError: vi.fn(),
  settings: { mcp_servers: [] },
  tunnel: false,
  tunnelRequest: vi.fn(),
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
vi.mock("../../apis/agentTunnel", () => ({
  // The tunnel is a deployment setting; the hook must pick the HTTP browser leg
  // from it instead of opening a WebSocket the page could not reach.
  agentTunnelEnabled: () => mocks.tunnel,
  tunnelRequest: (...args: unknown[]) => mocks.tunnelRequest(...args),
}));

import {
  bridgeBaseFor,
  bridgeUsesTunnel,
  useAgentBridge,
  wantsSidecar,
} from "../useAgentBridge";

const props = {
  agent: { id: "agent-1", name: "Example agent" },
  workspaceId: "ws-1",
  writable: false,
  mcp: false,
  mounts: [],
  providers: new Map(),
  rootProvider: null,
};

/** Stable identity: the hook restarts whenever `agent` changes. */
const serviceAgent = { id: "local-1", serviceAgentId: "svc-1" };

const sessionResponse = {
  id: "session-1",
  token: "browser-token",
  agentToken: "agent-token",
  runId: "session-1",
  wsUrl: "/agents/svc-1/bridge/ws?id=session-1",
  agentWsUrl: "ws://agent-service.test/agents/svc-1/bridge/agent?id=session-1",
  mcpUrl: "http://agent-service.test/agents/svc-1/bridge/mcp/session-1",
  expiresAt: Date.now() + 60_000,
};

const tunnelSession = {
  ...sessionResponse,
  pollUrl: "/agents/svc-1/bridge/poll/session-1?token=browser-token",
  replyUrl: "/agents/svc-1/bridge/reply/session-1?token=browser-token",
};

/** The shape `tunnelRequest` returns: a real `Response` stand-in. */
const jsonResponse = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  url: string;
  protocols: string[];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = Array.isArray(protocols)
      ? protocols
      : protocols
        ? [protocols]
        : [];
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
  // `mockClear`, not `mockReset`: Testing Library's cleanup unmounts after this
  // hook, and the deleted tunnel session still calls the last implementation.
  mocks.tunnelRequest.mockClear();
  mocks.tunnel = false;
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

  it("tunnels the session and the browser leg when only the model endpoint is reachable", async () => {
    // A tunneled deployment has no `/agents` route on the origin, so every bridge
    // request rides a chat completion and the browser leg is long-polled.
    mocks.tunnel = true;
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const visible = new Promise(() => {});
    let polls = 0;
    mocks.tunnelRequest.mockImplementation((call: any) => {
      if (call.method === "POST" && call.path.endsWith("/bridge/sessions")) {
        return Promise.resolve(jsonResponse(200, tunnelSession));
      }
      polls += 1;
      if (polls === 1) return Promise.resolve(jsonResponse(200, { type: "ready" }));
      // Park the loop: a real poll waits for the next tool call.
      return visible;
    });

    const { result } = renderHook(() =>
      useAgentBridge({
        ...props,
        agent: serviceAgent,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("online"));

    const [create] = mocks.tunnelRequest.mock.calls;
    expect(create[0]).toMatchObject({
      method: "POST",
      path: "/agents/svc-1/bridge/sessions",
      body: { agentId: "local-1", workspaceId: "ws-1" },
    });
    // The page never opens a socket and never calls the origin's `/agents`.
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.unavailable).toBe(false);
  });

  it("answers a tool call through the tunnel's reply route", async () => {
    mocks.tunnel = true;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    const parked = new Promise(() => {});
    let polls = 0;
    mocks.tunnelRequest.mockImplementation((call: any) => {
      if (call.method === "POST" && call.path.endsWith("/bridge/sessions")) {
        return Promise.resolve(jsonResponse(200, tunnelSession));
      }
      if (call.method === "POST") {
        return Promise.resolve(jsonResponse(204, null));
      }
      polls += 1;
      if (polls === 1) return Promise.resolve(jsonResponse(200, { type: "ready" }));
      if (polls === 2) {
        return Promise.resolve(
          jsonResponse(200, {
            type: "tool_call",
            requestId: "call-1",
            name: "mcp_list_servers",
            arguments: {},
          }),
        );
      }
      return parked;
    });

    renderHook(() =>
      useAgentBridge({
        ...props,
        mcp: true,
        agent: serviceAgent,
      }),
    );

    await waitFor(() =>
      expect(
        mocks.tunnelRequest.mock.calls.some(
          ([call]: any[]) =>
            call.method === "POST" && call.path === tunnelSession.replyUrl,
        ),
      ).toBe(true),
    );
    const reply = mocks.tunnelRequest.mock.calls.find(
      ([call]: any[]) => call.path === tunnelSession.replyUrl,
    );
    expect(reply[0].body).toMatchObject({
      type: "tool_result",
      requestId: "call-1",
      ok: true,
      result: [],
    });
  });

  it("deletes a tunneled session with the token in the query", async () => {
    // A completion carries no `authorization` header, so the delete names the
    // session token itself; the service accepts it there.
    mocks.tunnel = true;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    const parked = new Promise(() => {});
    let polls = 0;
    mocks.tunnelRequest.mockImplementation((call: any) => {
      if (call.method === "POST" && call.path.endsWith("/bridge/sessions")) {
        return Promise.resolve(jsonResponse(200, tunnelSession));
      }
      if (call.method === "DELETE") return Promise.resolve(jsonResponse(204, null));
      polls += 1;
      if (polls === 1) return Promise.resolve(jsonResponse(200, { type: "ready" }));
      // A loop that answers immediately would spin without ever yielding.
      return parked;
    });

    const { unmount } = renderHook(() =>
      useAgentBridge({
        ...props,
        agent: serviceAgent,
      }),
    );

    await waitFor(() =>
      expect(mocks.tunnelRequest).toHaveBeenCalledWith(
        expect.objectContaining({ path: tunnelSession.pollUrl }),
        expect.anything(),
      ),
    );

    unmount();

    await waitFor(() =>
      expect(
        mocks.tunnelRequest.mock.calls.some(
          ([call]: any[]) => call.method === "DELETE",
        ),
      ).toBe(true),
    );
    const removed = mocks.tunnelRequest.mock.calls.find(
      ([call]: any[]) => call.method === "DELETE",
    );
    expect(removed[0].path).toBe(
      `/agents/svc-1/bridge/sessions/session-1?token=browser-token`,
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

    // Only the agent service is reachable through the model endpoint; a direct
    // OpenCode agent keeps its own URL and its WebSocket.
    mocks.tunnel = true;
    expect(bridgeUsesTunnel({ id: "local-1", serviceAgentId: "svc-1" })).toBe(true);
    expect(bridgeUsesTunnel({ id: "local-1" })).toBe(false);
    mocks.tunnel = false;
    expect(bridgeUsesTunnel({ id: "local-1", serviceAgentId: "svc-1" })).toBe(false);
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
        agent: serviceAgent,
      }),
    );

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/agents/svc-1/bridge/sessions",
    );
    expect(FakeWebSocket.instances[0].url).toBe(
      `ws://${window.location.host}${sessionResponse.wsUrl}`,
    );
    expect(FakeWebSocket.instances[0].protocols).toEqual([
      "bridge.v1",
      "bridge-token.browser-token",
    ]);
    expect(result.current.status).toBe("connecting");
  });

  it("deletes a session created after the hook was torn down", async () => {
    // The POST can finish after cleanup has already run with no session to delete. The
    // response still created a live bridge session, so that branch must remove it itself.
    let resolvePost: ((response: any) => void) | undefined;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Promise((resolve) => {
          resolvePost = resolve;
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("WebSocket", FakeWebSocket);

    const { unmount } = renderHook(() => useAgentBridge(props));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    unmount();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    if (!resolvePost) throw new Error("POST was not started");
    resolvePost({ ok: true, status: 200, json: async () => sessionResponse });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${window.location.origin}/bridge/sessions/session-1`,
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "DELETE",
      headers: { Authorization: "Bearer browser-token" },
    });
    expect(FakeWebSocket.instances).toHaveLength(0);
  });
});
