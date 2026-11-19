import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { callMcpServerTool, listMcpServerTools } from "../agent/mcp";
import type { Vfs } from "../agent/vfs";
import { AGENT_SERVICE_PATH } from "../apis/agentService";
import { agentTunnelEnabled, tunnelRequest } from "../apis/agentTunnel";
import {
  addOpencodeMcpServer,
  connectOpencodeMcpServer,
  removeOpencodeMcpServer,
} from "../apis/opencodeAgents";
import type { WorkspaceMountRow } from "../db/dbTypes";
import { selectUserSettings } from "../Redux/reducers/userSettingsReducer";
import { WorkspaceAgentVfs } from "../workspace/agentVfs";
import { joinPath } from "../workspace/paths";
import type { BrowserProvider } from "../workspace/providers/browser";
import type { FileProvider } from "../workspace/providers/types";
import { useToast } from "./useToast";

type BridgeStatus = "off" | "connecting" | "online" | "offline" | "error";

/** The backend answers 404/405 on `/bridge/sessions`: this deployment has no bridge. */
class BridgeUnavailableError extends Error {
  readonly url: string;
  readonly status: number;

  constructor(url: string, status: number) {
    super(`No bridge endpoint at ${url} (HTTP ${status})`);
    this.url = url;
    this.status = status;
  }
}

/**
 * The bridge route exists but refused this client: the two sides are not configured with
 * the same secret, or the backend has none. The status tells them apart.
 */
class BridgeRejectedError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Bridge session failed (${status})`);
    this.status = status;
  }
}

type BridgeInput = {
  agent: any;
  workspaceId?: string | null;
  writable: boolean;
  mcp: boolean;
  mounts: WorkspaceMountRow[];
  providers: Map<string, FileProvider>;
  rootProvider: BrowserProvider | null;
};

const BACKEND = String(import.meta.env.VITE_BACKEND_ENDPOINT || "").replace(
  /\/+$/,
  "",
);
const BRIDGE_KEY = String(import.meta.env.VITE_BRIDGE_KEY || "").trim();

/**
 * Where the bridge routes live.
 *
 * An agent owned by the SAIA agent service is served by that service on the
 * app's own origin (`/agents/<id>/bridge/...`), which is what a SAIA deployment
 * has. A direct OpenCode agent falls back to the configured backend, where
 * `back` serves the same protocol at `/bridge`. The service URL stays relative
 * so the page origin decides where the browser connects, not the backend config.
 */
export const bridgeBaseFor = (agent: any, backend: string) =>
  agent?.serviceAgentId
    ? `${AGENT_SERVICE_PATH}/${encodeURIComponent(agent.serviceAgentId)}`
    : backend || (typeof window !== "undefined" ? window.location.origin : "");

const bridgeBase = (agent: any) => bridgeBaseFor(agent, BACKEND);

/**
 * Whether this bridge has to travel through the model endpoint.
 *
 * Only the agent service is reachable that way (its routes start with `/agents`);
 * a direct OpenCode agent keeps its own backend URL, so its bridge stays a plain
 * request and a WebSocket.
 */
export const bridgeUsesTunnel = (agent: any) =>
  agentTunnelEnabled() && !!agent?.serviceAgentId;

/**
 * The service returns the browser leg as a path; a WebSocket needs an absolute
 * URL. Absolute URLs from `back` are passed through unchanged.
 */
const socketUrl = (url: string) => {
  if (!url || /^wss?:\/\//i.test(url)) return url;
  const origin =
    typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`
      : "";
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
};

const SIDECAR_COMMAND = (() => {
  const raw = import.meta.env.VITE_OPENCODE_BRIDGE_SIDECAR_COMMAND;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) && parsed.length
      ? parsed.map((value) => String(value))
      : null;
  } catch {
    return null;
  }
})();

/** An argv list from JSON, or `null` when it names nothing runnable. */
const commandList = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || !value.length) return null;
  const parts = value.map((item) => String(item ?? "").trim());
  return parts[0] ? parts : null;
};

/**
 * The stdio sidecar command to register, or `null` for the HTTP fallback.
 *
 * A direct agent spawns the sidecar from the browser's own path, so its command
 * comes from `opencodeBridgeSidecarCommand` in `front.json`. With a
 * service-managed agent OpenCode runs inside the agent service, where that path
 * does not exist: the service names a command only that host can know in the
 * session response, and it wins for such an agent.
 */
export const sidecarCommandFor = (
  command: string[] | null,
  agent: any,
  serviceCommand?: unknown,
) =>
  commandList(agent?.serviceAgentId ? serviceCommand : command);

/**
 * Whether the bridge talks MCP through a stdio sidecar instead of the HTTP
 * `mcpUrl`. The caller must still require `agentWsUrl`/`agentToken`: a sidecar
 * without a socket has nothing to connect to.
 */
export const wantsSidecar = (
  command: string[] | null,
  agent: any,
  serviceCommand?: unknown,
) => !!sidecarCommandFor(command, agent, serviceCommand);

const stubVfs: Vfs = {
  readFile: async () => {
    throw new Error("Not available through the bridge");
  },
  writeFile: async () => {
    throw new Error("Not available through the bridge");
  },
  mkdir: async () => {
    throw new Error("Not available through the bridge");
  },
  readdir: async () => [],
  stat: async () => null,
  remove: async () => {
    throw new Error("Not available through the bridge");
  },
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const readMcpServers = (settings: any) =>
  (Array.isArray(settings?.mcp_servers) ? settings.mcp_servers : []).filter(
    (server: any) =>
      server?.kind === "local" &&
      typeof server.url === "string" &&
      server.url.trim(),
  );

export function useAgentBridge({
  agent,
  workspaceId,
  writable,
  mcp,
  mounts,
  providers,
  rootProvider,
}: BridgeInput) {
  const userSettings = useSelector(selectUserSettings);
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const notifyRef = useRef(notifyError);
  const tRef = useRef(t);
  const providersRef = useRef(providers);
  const mountsRef = useRef(mounts);
  const rootRef = useRef(rootProvider);
  const [status, setStatus] = useState<BridgeStatus>("off");
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [tabAway, setTabAway] = useState(false);

  notifyRef.current = notifyError;
  tRef.current = t;
  providersRef.current = providers;
  mountsRef.current = mounts;
  rootRef.current = rootProvider;

  const mcpServers = useMemo(() => readMcpServers(userSettings), [userSettings]);

  useEffect(() => {
    if (!agent?.id || !workspaceId) {
      // Idle means idle: a "this deployment has no bridge" verdict belongs to the attempt it
      // was learned from, so it must not outlive the workspace that was detached since.
      setStatus("off");
      setError("");
      setUnavailable(false);
      return;
    }
    let cancelled = false;
    let socket: WebSocket | null = null;
    let pollController: AbortController | null = null;
    let retryTimer: number | null = null;
    let session: any = null;
    let sessionDeleted = false;
    let mcpName = "";
    let wasHidden = false;
    const originalTitle = document.title;
    const tunneled = bridgeUsesTunnel(agent);

    /**
     * One bridge request: carried in a chat completion when only the model
     * endpoint is reachable, otherwise a plain request to `/agents`.
     */
    const callBridge = (
      path: string,
      init: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
      signal?: AbortSignal,
    ) =>
      tunneled
        ? tunnelRequest(
            {
              method: init.method || "GET",
              path,
              headers: init.headers || {},
              body: init.body ?? null,
            },
            signal,
          )
        : fetch(path, {
            method: init.method,
            signal,
            headers: {
              ...(init.body !== undefined
                ? { "Content-Type": "application/json" }
                : {}),
              ...(init.headers || {}),
            },
            ...(init.body !== undefined
              ? { body: JSON.stringify(init.body) }
              : {}),
          });

    /** How the browser answers a tool call; set by whichever leg started. */
    let sendResult: (payload: unknown) => void = () => {};

    const deleteSession = () => {
      const created = session;
      if (sessionDeleted || !created?.id || !created?.token) return;
      sessionDeleted = true;
      const path = `${bridgeBase(agent)}/bridge/sessions/${created.id}`;
      if (tunneled) {
        // A chat completion carries no `authorization` header, so the token
        // travels in the query — the same place the socket legs put it.
        void callBridge(
          `${path}?token=${encodeURIComponent(created.token)}`,
          { method: "DELETE" },
        ).catch(() => {});
        return;
      }
      void fetch(path, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${created.token}` },
      }).catch(() => {});
    };

    const connectSocket = (url: string, token: string) => {
      if (cancelled) return;
      socket = new WebSocket(url, ["bridge.v1", `bridge-token.${token}`]);
      sendResult = (payload) => socket?.send(JSON.stringify(payload));
      socket.onopen = () => {
        if (cancelled) return;
        setStatus("online");
        setError("");
      };
      socket.onmessage = (event) => {
        let message: any;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (message?.type !== "tool_call") return;
        void handleToolCall(message);
      };
      socket.onclose = () => {
        if (cancelled) return;
        setStatus("offline");
        retryTimer = window.setTimeout(() => {
          if (!cancelled) connectSocket(url, token);
        }, 3000);
      };
      socket.onerror = () => {
        if (!cancelled) setStatus("offline");
      };
    };

    const pause = (ms: number) =>
      new Promise<void>((resolve) => {
        retryTimer = window.setTimeout(resolve, ms);
      });

    /**
     * The browser leg over long-poll, for a deployment where the page has no
     * WebSocket to `/agents` (the model tunnel). It carries the same
     * `tool_call` messages as the socket and answers them through `replyUrl`,
     * so `handleToolCall` is shared by both transports.
     */
    const pollBridge = async (pollUrl: string, replyUrl: string) => {
      sendResult = (payload) => {
        void callBridge(
          replyUrl,
          { method: "POST", body: payload },
        ).catch(() => {});
      };
      while (!cancelled) {
        const controller = new AbortController();
        pollController = controller;
        let message: any = null;
        try {
          const response = await callBridge(
            pollUrl,
            { method: "GET" },
            controller.signal,
          );
          if (cancelled) return;
          if (response.status === 404) {
            // The service's registry is in memory, so a restart drops the
            // session; polling the same id would 404 forever.
            setUnavailable(true);
            setStatus("error");
            const detail = tRef.current("agents.bridge.unavailable_detail", {
              url: pollUrl.split("?")[0],
              status: response.status,
            });
            setError(detail);
            notifyRef.current(detail);
            return;
          }
          if (!response.ok) {
            setStatus("offline");
            await pause(3000);
            continue;
          }
          message = await response.json().catch(() => null);
        } catch {
          // An abort is this effect's own cleanup, not a broken bridge.
          if (cancelled) return;
          setStatus("offline");
          await pause(3000);
          continue;
        } finally {
          pollController = null;
        }
        if (cancelled) return;
        setStatus("online");
        setError("");
        if (message?.type === "tool_call") void handleToolCall(message);
      }
    };

    const prepareProviders = async () => {
      if (rootRef.current && rootRef.current.status !== "connected") {
        await rootRef.current.connect();
      }
      for (const provider of providersRef.current.values()) {
        if (provider.status !== "connected") {
          await provider.connect().catch(() => {});
        }
      }
    };

    const bridgeVfs = () => {
      const root = rootRef.current;
      if (!root) throw new Error("The selected workspace has no browser root.");
      const bindings = mountsRef.current
        .map((mount) => ({
          mount,
          provider: providersRef.current.get(mount.sourceId),
        }))
        .filter(
          (entry): entry is { mount: WorkspaceMountRow; provider: FileProvider } =>
            !!entry.provider,
        );
      return new WorkspaceAgentVfs(stubVfs, workspaceId, root, bindings);
    };

    const handleToolCall = async (message: any) => {
      const { requestId, name, arguments: args = {} } = message;
      try {
        let result: unknown;
        if (name.startsWith("workspace_")) {
          await prepareProviders();
          const vfs = bridgeVfs();
          const path = joinPath("/", String(args.path ?? "/"));
          if (name === "workspace_list") {
            result = await vfs.readdir(path);
          } else if (name === "workspace_stat") {
            const stat = await vfs.stat(path);
            result = { path, exists: !!stat, dir: stat?.dir ?? false };
          } else if (name === "workspace_read") {
            const bytes = await vfs.readFile(path);
            if (bytes.byteLength > 2 * 1024 * 1024) {
              result = {
                path,
                size: bytes.byteLength,
                message: "File is too large to return through the bridge.",
              };
            } else if (bytes.includes(0)) {
              result = {
                path,
                size: bytes.byteLength,
                encoding: "base64",
                content: bytesToBase64(bytes),
              };
            } else {
              result = {
                path,
                size: bytes.byteLength,
                content: new TextDecoder().decode(bytes),
              };
            }
          } else if (name === "workspace_write") {
            if (!writable) throw new Error("Workspace writes are disabled for this agent.");
            await vfs.writeFile(path, String(args.content ?? ""));
            result = { path, written: true };
          } else if (name === "workspace_mkdir") {
            if (!writable) throw new Error("Workspace writes are disabled for this agent.");
            await vfs.mkdir(path);
            result = { path, created: true };
          } else if (name === "workspace_remove") {
            if (!writable) throw new Error("Workspace writes are disabled for this agent.");
            await vfs.remove(path);
            result = { path, removed: true };
          } else {
            throw new Error(`Unknown workspace tool: ${name}`);
          }
        } else if (name === "mcp_list_servers") {
          if (!mcp) throw new Error("Local MCP access is disabled for this agent.");
          result = mcpServers.map((server: any) => ({
            id: server.id,
            name: server.name || server.id,
          }));
        } else if (name === "mcp_list_tools") {
          if (!mcp) throw new Error("Local MCP access is disabled for this agent.");
          const server = mcpServers.find(
            (item: any) =>
              item.id === args.server || item.name === args.server,
          );
          if (!server) throw new Error(`Unknown MCP server: ${args.server}`);
          result = await listMcpServerTools({
            url: server.url,
            headers: server.headers,
            enabled: true,
          });
        } else if (name === "mcp_call") {
          if (!mcp) throw new Error("Local MCP access is disabled for this agent.");
          const server = mcpServers.find(
            (item: any) =>
              item.id === args.server || item.name === args.server,
          );
          if (!server) throw new Error(`Unknown MCP server: ${args.server}`);
          result = await callMcpServerTool(
            {
              url: server.url,
              headers: server.headers,
              enabled: true,
            },
            String(args.tool ?? ""),
            (args.arguments as Record<string, unknown>) ?? {},
          );
        } else {
          throw new Error(`Unknown bridge tool: ${name}`);
        }
        sendResult({
          type: "tool_result",
          requestId,
          ok: true,
          result,
        });
      } catch (reason) {
        sendResult({
          type: "tool_result",
          requestId,
          ok: false,
          error: reason instanceof Error ? reason.message : String(reason),
        });
      }
    };

    const start = async () => {
      setStatus("connecting");
      setError("");
      setUnavailable(false);
      try {
        const sessionUrl = `${bridgeBase(agent)}/bridge/sessions`;
        const response = await callBridge(sessionUrl, {
          method: "POST",
          headers: BRIDGE_KEY ? { "x-bridge-key": BRIDGE_KEY } : {},
          body: {
            agentId: agent.id,
            workspaceId,
            writable,
            mcp,
          },
        });
        if (response.status === 404 || response.status === 405) {
          // Only `back` and the agent service serve `/bridge/*`. A direct engine endpoint
          // answers this URL itself with 404, which means the deployment has no bridge.
          throw new BridgeUnavailableError(sessionUrl, response.status);
        }
        if (!response.ok) throw new BridgeRejectedError(response.status);
        session = await response.json();
        if (cancelled) {
          deleteSession();
          return;
        }
        if (tunneled && !session.pollUrl) {
          // An older agent service has no HTTP browser leg; without it the tunnel
          // has no way to reach this page at all.
          deleteSession();
          throw new BridgeUnavailableError(sessionUrl, 404);
        }
        mcpName = `chatai-bridge-${String(session.id).slice(0, 8)}`;
        const sidecarCommand = sidecarCommandFor(
          SIDECAR_COMMAND,
          agent,
          session.sidecarCommand,
        );
        if (sidecarCommand && session.agentWsUrl && session.agentToken) {
          const scopes = [
            "workspace",
            writable ? "write" : "",
            mcp ? "mcp" : "",
          ]
            .filter(Boolean)
            .join(",");
          await addOpencodeMcpServer(agent, mcpName, {
            type: "local",
            command: sidecarCommand,
            codemode: false,
            environment: {
              CHAT_AI_BRIDGE_URL: session.agentWsUrl,
              CHAT_AI_BRIDGE_TOKEN: session.agentToken,
              CHAT_AI_BRIDGE_SCOPES: scopes,
            },
          });
        } else {
          await addOpencodeMcpServer(agent, mcpName, {
            type: "remote",
            url: session.mcpUrl,
            headers: { Authorization: `Bearer ${session.token}` },
          });
        }
        await connectOpencodeMcpServer(agent, mcpName);
        if (!cancelled) {
          if (tunneled) {
            void pollBridge(session.pollUrl, session.replyUrl);
          } else {
            connectSocket(socketUrl(session.wsUrl), session.token);
          }
        }
      } catch (reason) {
        if (!cancelled) {
          const missing = reason instanceof BridgeUnavailableError;
          const refused = reason instanceof BridgeRejectedError ? reason.status : 0;
          const message = reason instanceof Error ? reason.message : String(reason);
          const detail = missing
            ? tRef.current("agents.bridge.unavailable_detail", {
                url: reason.url,
                status: reason.status,
              })
            : refused === 503
              ? tRef.current("agents.bridge.disabled_by_server")
              : refused === 401
                ? tRef.current("agents.bridge.key_rejected")
                : // A blocked CORS preflight or a stopped service reaches the page as an
                  // opaque `TypeError`, so name the URL and the allowlist instead.
                  reason instanceof TypeError
                  ? tRef.current("agents.bridge.unreachable", {
                      url: `${bridgeBase(agent)}/bridge/sessions`,
                    })
                  : message;
          setUnavailable(missing);
          setStatus("error");
          setError(detail);
          // The file panel used to print this; it has no bridge section any more, so report the
          // failure where the user is instead of leaving the switch silently ineffective. The
          // toast carries `detail`, not the bare status, because it is the copy the user reads
          // first and the status alone never says what to fix.
          notifyRef.current(
            missing
              ? detail
              : tRef.current("agents.bridge.start_failed", { message: detail }),
          );
        }
      }
    };

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
        document.title = `⚠ Keep this tab open — ${originalTitle}`;
        setTabAway(true);
      } else {
        document.title = originalTitle;
        if (wasHidden) {
          wasHidden = false;
          notifyRef.current(tRef.current("agents.bridge.tab_warning"));
        }
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    void start();

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      document.title = originalTitle;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      pollController?.abort();
      socket?.close();
      if (mcpName) {
        void removeOpencodeMcpServer(agent, mcpName).catch(() => {});
      }
      deleteSession();
    };
    // Deliberately not `[agent]`: switching the agent's OpenCode session only changes
    // `sessionId` plus its summaries, and the bridge is agent-scoped (one MCP server in that
    // agent's OpenCode, one workspace link), so a session switch must keep the running bridge
    // instead of tearing it down and registering a second one. Only the fields that decide
    // where and how it connects restart it.
  }, [
    agent?.id,
    agent?.serviceAgentId,
    agent?.serverUrl,
    agent?.username,
    agent?.password,
    workspaceId,
    writable,
    mcp,
    mcpServers,
  ]);

  return { status, error, tabAway, unavailable };
}
