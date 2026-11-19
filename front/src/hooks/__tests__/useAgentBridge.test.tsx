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
vi.mock("../../agent/mcp", () => ({
  normalizeMcpUrl: (url: unknown) => String(url ?? "").trim(),
  // The browser's own MCP client: the hook only relays its answer (or its error) to the
  // sidecar, so the test asserts the message the model would read.
  listMcpServerTools: vi.fn(async () => {
    throw new Error(
      "Could not reach the MCP server at http://crm.test/mcp: the browser must be able to call it.",
    );
  }),
  callMcpServerTool: vi.fn(async () => ""),
}));
vi.mock("../../apis/agentTunnel", () => ({
  // The tunnel is a deployment setting; the hook must pick the HTTP browser leg
  // from it instead of opening a WebSocket the page could not reach.
  agentTunnelEnabled: () => mocks.tunnel,
  tunnelRequest: (...args: unknown[]) => mocks.tunnelRequest(...args),
}));

import {
  addOpencodeMcpServer,
  removeOpencodeMcpServer,
} from "../../apis/opencodeAgents";
import {
  bridgeBaseFor,
  bridgeUsesTunnel,
  sidecarCommandFor,
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

/** Stable identity: the bridge restarts only when its connection fields change. */
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

  it("names a missing bridge secret instead of a generic start failure", async () => {
    // `back` fails closed: without BRIDGE_SHARED_SECRET it answers 503, and the
    // browser cannot start a bridge at all. The popover must say why.
    vi.stubGlobal("fetch", respond(503));

    const { result } = renderHook(() => useAgentBridge(props));

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.unavailable).toBe(false);
    expect(result.current.error).toContain("503");
    expect(result.current.error).toContain("bridgeSharedSecret");
    expect(mocks.notifyError).toHaveBeenCalledTimes(1);
    expect(String(mocks.notifyError.mock.calls[0][0])).toContain(
      "bridgeSharedSecret",
    );
  });

  it("points an unreachable bridge at the origin allowlist", async () => {
    // A blocked CORS preflight arrives as an opaque `TypeError`, so the status is
    // unavailable and the message has to name the URL and what to check.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const { result } = renderHook(() => useAgentBridge(props));

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.unavailable).toBe(false);
    expect(result.current.error).toContain("/bridge/sessions");
    expect(result.current.error).toContain("corsOrigins");
  });

  it("names a rejected bridge key", async () => {
    // The secret is set on both sides but they differ: `back` answers 401.
    vi.stubGlobal("fetch", respond(401));

    const { result } = renderHook(() => useAgentBridge(props));

    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.unavailable).toBe(false);
    expect(result.current.error).toContain("401");
    expect(result.current.error).toContain("bridgeKey");
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

  it("keeps the running bridge when only the agent's session changes", async () => {
    // The bridge is registered in the agent's own OpenCode and exposes its workspace, so it
    // belongs to the agent, not to one session: switching sessions must not tear it down and
    // start a second one (which is what lost the user's write/MCP settings until it returned).
    const fetchMock = vi.fn(async (_url: string, init?: { method?: string }) =>
      init?.method === "POST"
        ? { ok: true, status: 200, json: async () => sessionResponse }
        : { ok: true, status: 200, json: async () => ({}) },
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.mocked(addOpencodeMcpServer).mockClear();
    vi.mocked(removeOpencodeMcpServer).mockClear();

    const { rerender } = renderHook(
      ({ agent }) => useAgentBridge({ ...props, agent }),
      { initialProps: { agent: serviceAgent } },
    );
    await waitFor(() => expect(addOpencodeMcpServer).toHaveBeenCalledTimes(1));

    rerender({ agent: { ...serviceAgent, sessionId: "session-2" } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const creates = fetchMock.mock.calls.filter(
      ([url, init]) => init?.method === "POST" && String(url).endsWith("/bridge/sessions"),
    );
    expect(creates).toHaveLength(1);
    expect(addOpencodeMcpServer).toHaveBeenCalledTimes(1);
    expect(removeOpencodeMcpServer).not.toHaveBeenCalled();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("restarts when the workspace or the settings change", async () => {
    // The counterpart: the session switch above is only free because a real change still
    // reconnects, with the new options in the session request.
    const fetchMock = vi.fn(async (_url: string, init?: { method?: string }) =>
      init?.method === "POST"
        ? { ok: true, status: 200, json: async () => sessionResponse }
        : { ok: true, status: 200, json: async () => ({}) },
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("WebSocket", FakeWebSocket);

    const { rerender } = renderHook(
      ({ mcp }) => useAgentBridge({ ...props, agent: serviceAgent, mcp }),
      { initialProps: { mcp: false } },
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url, init]) =>
          init?.method === "POST" && String(url).endsWith("/bridge/sessions"),
        ),
      ).toHaveLength(1),
    );

    rerender({ mcp: true });

    await waitFor(() => {
      const bodies = fetchMock.mock.calls
        .filter(([url, init]) => init?.method === "POST" && String(url).endsWith("/bridge/sessions"))
        .map(([, init]) => JSON.parse(String(init?.body ?? "{}")));
      expect(bodies).toHaveLength(2);
      expect(bodies[1]).toMatchObject({ agentId: "local-1", workspaceId: "ws-1", mcp: true });
    });
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

  it("does not relay a server OpenCode already connected itself", async () => {
    // Injection and relay must not offer the same server twice: the native entry is the
    // better one (real tools), so the relay carries only the servers that could not be
    // injected. The exclusion is read at call time, so finishing an injection does not have
    // to restart the running bridge.
    mocks.settings = {
      mcp_servers: [
        {
          id: "direct",
          name: "Direct",
          kind: "local",
          url: "http://direct.test/mcp",
        },
        {
          id: "relay",
          name: "Relay",
          kind: "local",
          url: "http://relay.test/mcp",
        },
      ],
    };
    mocks.tunnel = true;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    const parked = new Promise(() => {});
    let polls = 0;
    mocks.tunnelRequest.mockImplementation((call: any) => {
      if (call.method === "POST" && call.path.endsWith("/bridge/sessions")) {
        return Promise.resolve(jsonResponse(200, tunnelSession));
      }
      if (call.method === "POST") return Promise.resolve(jsonResponse(204, null));
      polls += 1;
      if (polls === 1) return Promise.resolve(jsonResponse(200, { type: "ready" }));
      if (polls === 2) {
        return Promise.resolve(
          jsonResponse(200, {
            type: "tool_call",
            requestId: "call-excluded",
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
        excludedMcpUrls: ["http://direct.test/mcp"],
      }),
    );

    await waitFor(() => {
      const reply = mocks.tunnelRequest.mock.calls.find(
        ([call]: any[]) => call.path === tunnelSession.replyUrl,
      );
      expect(reply?.[0].body).toMatchObject({
        type: "tool_result",
        requestId: "call-excluded",
        ok: true,
        result: [{ id: "relay", name: "Relay" }],
      });
    });
    mocks.settings = { mcp_servers: [] };
  });

  it("relays a failed local MCP call as the model would read it", async () => {
    // `Failed to fetch` on its own says nothing; the hook must forward the message that
    // names the server and the cause instead of swallowing or rewording it.
    mocks.settings = {
      mcp_servers: [
        { id: "crm", name: "crm-mcp", kind: "local", url: "http://crm.test/mcp" },
      ],
    };
    mocks.tunnel = true;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    const parked = new Promise(() => {});
    let polls = 0;
    mocks.tunnelRequest.mockImplementation((call: any) => {
      if (call.method === "POST" && call.path.endsWith("/bridge/sessions")) {
        return Promise.resolve(jsonResponse(200, tunnelSession));
      }
      if (call.method === "POST") return Promise.resolve(jsonResponse(204, null));
      polls += 1;
      if (polls === 1) return Promise.resolve(jsonResponse(200, { type: "ready" }));
      if (polls === 2) {
        return Promise.resolve(
          jsonResponse(200, {
            type: "tool_call",
            requestId: "call-mcp",
            name: "mcp_list_tools",
            arguments: { server: "crm-mcp" },
          }),
        );
      }
      return parked;
    });

    renderHook(() =>
      useAgentBridge({ ...props, mcp: true, agent: serviceAgent }),
    );

    await waitFor(() => {
      const reply = mocks.tunnelRequest.mock.calls.find(
        ([call]: any[]) => call.path === tunnelSession.replyUrl,
      );
      expect(reply?.[0].body).toMatchObject({
        type: "tool_result",
        requestId: "call-mcp",
        ok: false,
        error: expect.stringContaining("http://crm.test/mcp"),
      });
    });
    mocks.settings = { mcp_servers: [] };
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

  it("keeps a direct agent on the deployment's sidecar command", () => {
    // A direct agent spawns the sidecar from the user's own OpenCode path.
    const command = ["/usr/bin/node", "/opt/chat-ai/bridge-sidecar.mjs"];

    expect(wantsSidecar(command, { id: "local-1" })).toBe(true);
    expect(wantsSidecar(null, { id: "local-1" })).toBe(false);
    // A service command never reaches a direct agent's own server.
    expect(wantsSidecar(null, { id: "local-1" }, ["node", "/srv/sidecar.mjs"])).toBe(false);
  });

  it("takes a service-managed agent's sidecar command from the service", () => {
    // The browser's command is a path in the user's OpenCode install, which does not
    // exist where a service agent runs OpenCode. Only the service knows a valid one.
    const local = ["/usr/bin/node", "/opt/chat-ai/bridge-sidecar.mjs"];
    const remote = ["node", "/srv/agent-service/bridge-sidecar.mjs"];

    expect(wantsSidecar(local, serviceAgent)).toBe(false);
    expect(wantsSidecar(local, serviceAgent, remote)).toBe(true);
    expect(sidecarCommandFor(local, serviceAgent, remote)).toEqual(remote);
    // Nothing runnable in the response means the HTTP fallback, not an empty command.
    expect(wantsSidecar(local, serviceAgent, [])).toBe(false);
    expect(wantsSidecar(local, serviceAgent, undefined)).toBe(false);
  });

  it("adds the mcp scope only while the toggle is on", async () => {
    vi.mocked(addOpencodeMcpServer).mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ...sessionResponse,
          sidecarCommand: ["node", "/srv/agent-service/bridge-sidecar.mjs"],
        }),
      })),
    );
    vi.stubGlobal("WebSocket", FakeWebSocket);

    // The sidecar builds its tool list from these scopes, so a session registered
    // without `mcp` can never offer mcp_list_servers, whatever the UI shows later.
    renderHook(() =>
      useAgentBridge({ ...props, agent: serviceAgent, mcp: true, writable: true }),
    );

    await waitFor(() => expect(addOpencodeMcpServer).toHaveBeenCalled());
    expect(vi.mocked(addOpencodeMcpServer).mock.calls[0][2]).toMatchObject({
      environment: {
        CHAT_AI_BRIDGE_SCOPES: "workspace,write,mcp",
      },
    });
  });

  it("registers a service agent's sidecar as a local MCP entry", async () => {
    vi.mocked(addOpencodeMcpServer).mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ...sessionResponse,
          sidecarCommand: ["node", "/srv/agent-service/bridge-sidecar.mjs"],
        }),
      })),
    );
    vi.stubGlobal("WebSocket", FakeWebSocket);

    renderHook(() => useAgentBridge({ ...props, agent: serviceAgent }));

    await waitFor(() => expect(addOpencodeMcpServer).toHaveBeenCalled());
    expect(vi.mocked(addOpencodeMcpServer).mock.calls[0][1]).toMatch(
      /^chatai-bridge-/,
    );
    expect(vi.mocked(addOpencodeMcpServer).mock.calls[0][2]).toMatchObject({
      type: "local",
      command: ["node", "/srv/agent-service/bridge-sidecar.mjs"],
      environment: expect.objectContaining({
        CHAT_AI_BRIDGE_URL: sessionResponse.agentWsUrl,
        CHAT_AI_BRIDGE_TOKEN: "agent-token",
      }),
    });
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
