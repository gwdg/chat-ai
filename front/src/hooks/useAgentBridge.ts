import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import {
  callMcpServerTool,
  callMcpServerToolResult,
  listMcpServerTools,
  normalizeMcpUrl,
} from "../agent/mcp";
import type { Vfs } from "../agent/vfs";
import {
  mcpServerStatus,
  mcpServerStatusError,
  sweepStaleWrappedEntries,
  waitForMcpStatus,
  wrappedMcpNames,
  wrappedMcpServers,
} from "../agents/agentMcpInjection";
import { bridgeKeyFor, bridgeKeyScope } from "../agents/bridgeKey";
import { AGENT_SERVICE_PATH } from "../apis/agentService";
import { agentTunnelEnabled, tunnelRequest } from "../apis/agentTunnel";
import {
  addOpencodeMcpServer,
  connectOpencodeMcpServer,
  listOpencodeMcpServers,
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
  /**
   * The OpenCode session the tools belong to. The registry itself is agent-wide, so the entry is
   * named after this session and only that session (and its subagents) may use it —
   * `agents/agentMcpScope.js` writes the permission rules that enforce it.
   */
  sessionId?: string | null;
  workspaceId?: string | null;
  writable: boolean;
  mcp: boolean;
  /**
   * MCP servers OpenCode already connected itself (`bridgeInjectExternal`). They are still in
   * the browser, but relaying them too would offer the same server twice, so the relay skips
   * them and serves only the ones that could not be injected.
   */
  excludedMcpUrls?: string[];
  /**
   * The "inject external MCP tools" option (`bridgeInjectExternal`). A server with a stored
   * token cannot be injected as a `remote` entry — that would copy the secret — so it becomes a
   * native stdio proxy instead, when the bridge can spawn one. Without the option it stays on
   * the relay, exactly as before.
   */
  wrapMcp?: boolean;
  mounts: WorkspaceMountRow[];
  providers: Map<string, FileProvider>;
  rootProvider: BrowserProvider | null;
};

const BACKEND = String(import.meta.env.VITE_BACKEND_ENDPOINT || "").replace(
  /\/+$/,
  "",
);
/**
 * The host that serves `/bridge/*` for a direct agent, when it is not `backendPath`.
 *
 * `backendPath` is where models come from, and in a local test stack that is the engine
 * (`…/public/v1`), which has no bridge route: the app is then a direct client of the engine and
 * the agent's bridge still belongs to `back`. Naming it here keeps the two apart. Empty means
 * "the backend also serves the bridge", which is the deployed Chat AI setup.
 */
const BRIDGE_ENDPOINT = String(import.meta.env.VITE_BRIDGE_PATH || "").replace(
  /\/+$/,
  "",
);
/**
 * The deployment's shared secret for `POST /bridge/sessions`.
 *
 * Optional and unrelated to the per-chat key (`agents/bridgeKey.js`): this one is a
 * deployment-wide gate that ships in the bundle, the other is generated per chat and never
 * leaves this browser. A host with `BRIDGE_SHARED_SECRET`/`bridgeSharedSecret` set needs this
 * header; a host without one accepts the request and relies on the per-chat key to pair the
 * two legs.
 */
const BRIDGE_KEY = String(import.meta.env.VITE_BRIDGE_KEY || "").trim();

/**
 * Where the bridge routes live.
 *
 * An agent owned by the SAIA agent service is served by that service on the
 * app's own origin (`/agents/<id>/bridge/...`), which is what a SAIA deployment
 * has. A direct OpenCode agent uses the configured bridge host — `bridgePath`
 * when the backend is not the Chat AI service itself — and falls back to the
 * backend, then to the page origin. The service URL stays relative so the page
 * origin decides where the browser connects, not the backend config.
 */
export const bridgeBaseFor = (
  agent: any,
  backend: string,
  bridgeEndpoint: string = BRIDGE_ENDPOINT,
) =>
  agent?.serviceAgentId
    ? `${AGENT_SERVICE_PATH}/${encodeURIComponent(agent.serviceAgentId)}`
    : bridgeEndpoint ||
      backend ||
      (typeof window !== "undefined" ? window.location.origin : "");

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
  // Any configured server with an address can be relayed; the configured `kind` is not a
  // routing decision here. A SAIA-gateway entry has only a server id and is answered by the
  // gateway itself, so it simply has no URL and drops out.
  (Array.isArray(settings?.mcp_servers) ? settings.mcp_servers : []).filter(
    (server: any) =>
      typeof server?.url === "string" && !!server.url.trim(),
  );

/** Every OpenCode entry this hook registers, and the session it belongs to. */
export const BRIDGE_ENTRY_PREFIX = "chatai-bridge-";
export const bridgeMcpName = (sessionId: string) =>
  `${BRIDGE_ENTRY_PREFIX}${sessionId}`;

/** One stdio proxy registered for a configured MCP server that carries a header. */
export type WrappedMcpEntry = {
  /** The OpenCode entry name (`chatai-auth-<server>-<session>`). */
  name: string;
  /** The configured server it proxies, as the browser resolves it. */
  server: { id: string; name: string; url: string };
};

/** A wrapped proxy that could not be started; the server stays on the relay. */
export type WrappedMcpFailure = WrappedMcpEntry & { error: string };

/**
 * Remove the bridge entries of sessions that are no longer open.
 *
 * OpenCode's registry is agent-wide and survives a page reload, so a crashed or closed tab
 * leaves its entry behind; without this sweep a user who opened the bridge in five sessions
 * would see five of them. Exactly one may exist at a time, and it is the one about to be
 * registered.
 */
export async function sweepStaleBridgeEntries(agent: any, keep: string) {
  const servers = await listOpencodeMcpServers(agent).catch(() => []);
  const stale = (Array.isArray(servers) ? servers : [])
    .map((server: any) => server?.name)
    .filter(
      (name: any) =>
        typeof name === "string" &&
        name.startsWith(BRIDGE_ENTRY_PREFIX) &&
        name !== keep,
    );
  for (const name of stale) {
    await removeOpencodeMcpServer(agent, name).catch(() => {});
  }
  return stale;
}

export function useAgentBridge({
  agent,
  sessionId,
  workspaceId,
  writable,
  mcp,
  excludedMcpUrls,
  wrapMcp,
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
  // The OpenCode entry belongs to one session. `entryName` mirrors it for the rename effect
  // below, which moves it when the user opens another session; the bridge session itself (the
  // socket, the workspace pairing) keeps running, so this is not a restart.
  const [entryName, setEntryName] = useState("");
  // The proxies registered for MCP servers whose token stays in the browser. Reported to the
  // page so their entry names take part in the per-session scope, and to the popover so the
  // relay count does not claim servers that now run as native stdio servers.
  const [wrappedEntries, setWrappedEntries] = useState<WrappedMcpEntry[]>([]);
  const [wrappedFailed, setWrappedFailed] = useState<WrappedMcpFailure[]>([]);
  const wrappedEntriesRef = useRef<WrappedMcpEntry[]>([]);
  wrappedEntriesRef.current = wrappedEntries;
  const sessionIdRef = useRef<string>("");
  const nameRef = useRef<string>("");
  const wrappedNamesRef = useRef<string[]>([]);
  // The per-chat key the running bridge session was created with. Resolved when the session
  // starts, not on render: the page renders this hook before the agent has been read from
  // localStorage, and a key generated for an empty agent id could never be found again.
  // It is not regenerated on a session switch either — the host remembers the key of the
  // session it minted, so the entries re-registered afterwards must present that same one.
  const chatKeyRef = useRef<{ scope: string; key: string } | null>(null);
  const configRef = useRef<Record<string, unknown> | null>(null);
  const aliveRef = useRef(false);
  const registerEntryRef = useRef<
    ((sessionId: string, previous?: string) => Promise<void>) | null
  >(null);
  const registerWrappedRef = useRef<
    ((sessionId: string) => Promise<void>) | null
  >(null);

  notifyRef.current = notifyError;
  tRef.current = t;
  providersRef.current = providers;
  mountsRef.current = mounts;
  rootRef.current = rootProvider;
  sessionIdRef.current = sessionId || "";

  const mcpServers = useMemo(() => readMcpServers(userSettings), [userSettings]);
  // A ref, not an effect dependency: injection finishes after the bridge is online, and
  // restarting the bridge (and re-registering its MCP server) just to shrink the relay list
  // would interrupt a running turn. Later tool calls read the current list.
  const excludedMcpUrlsRef = useRef(new Set<string>());
  excludedMcpUrlsRef.current = new Set(
    (excludedMcpUrls || [])
      .map((url) => normalizeMcpUrl(url))
      .filter(Boolean),
  );
  // The server a wrapped proxy belongs to. Registered proxies are looked up first, because
  // `relayMcpServers` deliberately hides them: OpenCode offers their tools through their own
  // stdio entry, so listing them on the relay too would duplicate every tool. The headers come
  // from the current settings, not from what was registered, so an edited token takes effect on
  // the next call — that is the whole point of keeping the secret in the page.
  const wrappedServer = (key: unknown) => {
    const wanted = String(key ?? "");
    const entry = wrappedEntriesRef.current.find(
      (item) => item.server.id === wanted || item.server.name === wanted,
    );
    if (!entry) return null;
    const configured = mcpServers.find((server: any) => {
      const url = normalizeMcpUrl(server?.url);
      if (entry.server.id && server?.id) return server.id === entry.server.id;
      return !!url && url === entry.server.url;
    });
    if (!configured) return null;
    return {
      ...configured,
      id: entry.server.id,
      name: configured.name || entry.server.name,
      url: entry.server.url,
      headers: configured.headers,
    };
  };
  const relayMcpServers = () => {
    const wrappedIds = new Set(
      wrappedEntriesRef.current.map((entry) => entry.server.id),
    );
    const wrappedUrls = new Set(
      wrappedEntriesRef.current
        .map((entry) => normalizeMcpUrl(entry.server.url))
        .filter(Boolean),
    );
    return mcpServers.filter((server: any) => {
      const url = normalizeMcpUrl(server?.url);
      if (excludedMcpUrlsRef.current.has(url)) return false;
      if (server?.id && wrappedIds.has(server.id)) return false;
      if (url && wrappedUrls.has(url)) return false;
      return true;
    });
  };

  useEffect(() => {
    if (!agent?.id || !workspaceId) {
      // Idle means idle: a "this deployment has no bridge" verdict belongs to the attempt it
      // was learned from, so it must not outlive the workspace that was detached since.
      setStatus("off");
      setError("");
      setUnavailable(false);
      return;
    }
    aliveRef.current = true;
    let cancelled = false;
    let socket: WebSocket | null = null;
    let pollController: AbortController | null = null;
    let retryTimer: number | null = null;
    let session: any = null;
    let sessionDeleted = false;
    let wasHidden = false;
    // The stdio proxies for MCP servers whose token must stay in the browser. Built in
    // `start()` once the session and its sidecar command are known; registering them waits
    // for the browser leg, because their first `tools/list` has to reach this page.
    let wrappedCandidates: any[] = [];
    let wrappedEnvironment: Record<string, string> | null = null;
    let wrappedCommand: string[] | null = null;
    let wrappedStarted = false;
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

    /**
     * Register the wrapped MCP proxies once the browser leg is up.
     *
     * Their first `tools/list` has to reach this page, and OpenCode asks for it right after it
     * spawns the process, so registering before the leg exists would leave them without tools.
     */
    const startWrapped = () => {
      if (wrappedStarted || cancelled) return;
      wrappedStarted = true;
      void registerWrappedRef.current?.(sessionIdRef.current);
    };

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
        startWrapped();
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
        startWrapped();
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
          result = relayMcpServers().map((server: any) => ({
            id: server.id,
            name: server.name || server.id,
          }));
        } else if (name === "mcp_list_tools") {
          // A registered stdio proxy is allowed even with the MCP switch off: it was only
          // created because the server needed one, and its calls reach the browser through the
          // same two messages as the relay's.
          const explicit = wrappedServer(args.server);
          if (!mcp && !explicit) {
            throw new Error("Local MCP access is disabled for this agent.");
          }
          const server =
            explicit ||
            relayMcpServers().find(
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
          const explicit = wrappedServer(args.server);
          if (!mcp && !explicit) {
            throw new Error("Local MCP access is disabled for this agent.");
          }
          const server =
            explicit ||
            relayMcpServers().find(
              (item: any) =>
                item.id === args.server || item.name === args.server,
            );
          if (!server) throw new Error(`Unknown MCP server: ${args.server}`);
          const options = {
            url: server.url,
            headers: server.headers,
            enabled: true,
          };
          // The wrapped proxy stands in for OpenCode's own connection to this server, so it
          // gets the upstream result unchanged (`content`, `isError`); the relay keeps the
          // flattened text its sidecar turns into one block.
          result = explicit
            ? await callMcpServerToolResult(
                options,
                String(args.tool ?? ""),
                (args.arguments as Record<string, unknown>) ?? {},
              )
            : await callMcpServerTool(
                options,
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

    /**
     * Register the bridge entry under one session's name, removing every other bridge entry.
     *
     * `previous` is the entry this hook registered before a session switch: the bridge session
     * and its socket are unchanged, only the OpenCode entry moves (a rename is not an API
     * OpenCode offers), so the registry never holds two bridges and no other session can use the
     * one it holds.
     */
    const registerEntry = async (sid: string, previous?: string) => {
      if (!aliveRef.current || !sid || !configRef.current) return;
      const name = bridgeMcpName(sid);
      if (previous && previous !== name) {
        await removeOpencodeMcpServer(agent, previous).catch(() => {});
      }
      await sweepStaleBridgeEntries(agent, name);
      await addOpencodeMcpServer(agent, name, configRef.current);
      await connectOpencodeMcpServer(agent, name);
      nameRef.current = name;
      if (aliveRef.current) setEntryName(name);
    };
    registerEntryRef.current = registerEntry;

    /**
     * Register one stdio proxy per MCP server that carries a header.
     *
     * A stored token may not leave the browser, so such a server cannot become a `remote`
     * entry. Instead OpenCode spawns the same bridge sidecar once per server in single-server
     * mode (`CHAT_AI_BRIDGE_SERVER`), and that proxy asks this page for the upstream's tools and
     * runs its calls — the header is applied here, on the Chat AI side.
     *
     * The entry name carries the session (`agents/agentMcpScope.js` scopes it), so this runs
     * again on a session switch. A proxy that cannot start is removed again and reported; the
     * server then stays on the relay, which is also what happens with no sidecar command at all
     * (the HTTP `mcpUrl` fallback cannot express stdio).
     */
    const registerWrappedEntries = async (sid: string) => {
      if (!aliveRef.current || !sid) return;
      const desired =
        wrappedEnvironment && wrappedCommand
          ? wrappedMcpNames(wrappedCandidates, sid)
          : wrappedMcpNames([], sid);
      await sweepStaleWrappedEntries(agent, new Set(desired.keys()));
      // Tracked as each proxy connects, not after the loop: a teardown that interrupts the
      // registration still has to remove what was already added.
      wrappedNamesRef.current = [];
      const existing = await listOpencodeMcpServers(agent).catch(() => []);
      const byName = new Map(
        (Array.isArray(existing) ? existing : []).map((item: any) => [
          item?.name,
          item,
        ]),
      );
      const connected: WrappedMcpEntry[] = [];
      const failed: WrappedMcpFailure[] = [];
      for (const [name, server] of desired) {
        if (cancelled || !aliveRef.current) return;
        const entry: WrappedMcpEntry = {
          name,
          server: { id: server.id, name: server.name, url: server.url },
        };
        try {
          const known = byName.get(name);
          if (!known) {
            await addOpencodeMcpServer(agent, name, {
              type: "local",
              command: wrappedCommand,
              // Same reason as the bridge entry: the per-session permission rules can only
              // deny a tool of its own, and Code Mode would hide the servers behind `execute`.
              codemode: false,
              environment: {
                ...wrappedEnvironment,
                CHAT_AI_BRIDGE_SERVER: String(server.id),
                CHAT_AI_BRIDGE_SERVER_NAME: String(server.name || server.id),
              },
            });
            await connectOpencodeMcpServer(agent, name);
          } else if (mcpServerStatus(known) !== "connected") {
            await connectOpencodeMcpServer(agent, name);
          }
          const status =
            mcpServerStatus(known) === "connected"
              ? known
              : await waitForMcpStatus(agent, name, {
                  attempts: 6,
                  delay: 500,
                  isCancelled: () => cancelled,
                });
          if (mcpServerStatus(status) === "connected") {
            connected.push(entry);
            wrappedNamesRef.current.push(name);
            continue;
          }
          await removeOpencodeMcpServer(agent, name).catch(() => {});
          failed.push({
            ...entry,
            error:
              mcpServerStatusError(status) ||
              (mcpServerStatus(status) === "pending"
                ? "Connection timed out"
                : "Could not connect"),
          });
        } catch (reason) {
          await removeOpencodeMcpServer(agent, name).catch(() => {});
          failed.push({
            ...entry,
            error: reason instanceof Error ? reason.message : String(reason),
          });
        }
      }
      if (aliveRef.current) {
        setWrappedEntries(connected);
        setWrappedFailed(failed);
      }
    };
    registerWrappedRef.current = registerWrappedEntries;

    const start = async () => {
      setStatus("connecting");
      setError("");
      setUnavailable(false);
      try {
        // One key per chat, from the frontend's own storage (`agents/bridgeKey.js`). A
        // restart of this effect reuses it; a different agent or session gets its own.
        const scope = bridgeKeyScope(agent.id, sessionIdRef.current);
        if (!chatKeyRef.current || chatKeyRef.current.scope !== scope) {
          chatKeyRef.current = { scope, key: bridgeKeyFor(scope) };
        }
        const chatKey = chatKeyRef.current.key;
        const sessionUrl = `${bridgeBase(agent)}/bridge/sessions`;
        const response = await callBridge(sessionUrl, {
          method: "POST",
          headers: BRIDGE_KEY ? { "x-bridge-key": BRIDGE_KEY } : {},
          body: {
            agentId: agent.id,
            workspaceId,
            writable,
            mcp,
            // The host remembers this for the session and only lets an agent socket attach
            // that presents it; the same value goes into every stdio entry below.
            key: chatKey,
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
          configRef.current = {
            type: "local",
            command: sidecarCommand,
            codemode: false,
            environment: {
              CHAT_AI_BRIDGE_URL: session.agentWsUrl,
              CHAT_AI_BRIDGE_TOKEN: session.agentToken,
              CHAT_AI_BRIDGE_SCOPES: scopes,
              // The agent leg must prove it belongs to this chat's session.
              CHAT_AI_BRIDGE_KEY: chatKey,
            },
          };
          // The authenticated servers need this same sidecar command. They follow the
          // injection option, not the relay switch: a native stdio proxy is OpenCode
          // connecting a server itself, it just keeps the header in this page.
          wrappedCommand = sidecarCommand;
          wrappedCandidates = wrapMcp ? wrappedMcpServers(mcpServers) : [];
          wrappedEnvironment = {
            CHAT_AI_BRIDGE_URL: session.agentWsUrl,
            CHAT_AI_BRIDGE_TOKEN: session.agentToken,
            CHAT_AI_BRIDGE_SCOPES: "mcp",
            CHAT_AI_BRIDGE_KEY: chatKey,
          };
        } else {
          configRef.current = {
            type: "remote",
            url: session.mcpUrl,
            headers: { Authorization: `Bearer ${session.token}` },
            // Code Mode would bury the bridge tools behind `execute`; the session scope in
            // `agents/agentMcpScope.js` can only deny what is a tool of its own.
            codemode: false,
          };
        }
        await registerEntry(sessionIdRef.current);
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
      aliveRef.current = false;
      configRef.current = null;
      registerEntryRef.current = null;
      registerWrappedRef.current = null;
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      document.title = originalTitle;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      pollController?.abort();
      socket?.close();
      if (nameRef.current) {
        // The name lives in a ref because the rename effect below may have replaced it; the
        // closure's own value would point at an entry that is already gone.
        void removeOpencodeMcpServer(agent, nameRef.current).catch(() => {});
        nameRef.current = "";
      }
      // Wrapped proxies belong to this bridge session and its agent token, so they go with it.
      for (const name of wrappedNamesRef.current) {
        void removeOpencodeMcpServer(agent, name).catch(() => {});
      }
      wrappedNamesRef.current = [];
      setEntryName("");
      setWrappedEntries([]);
      setWrappedFailed([]);
      deleteSession();
    };
    // Deliberately not `[agent]` or `[sessionId]`: a session switch only re-registers the MCP
    // entry under the new session's name (the effect below), while the one bridge session and
    // its socket keep running. Only the fields that decide where and how it connects restart it.
  }, [
    agent?.id,
    agent?.serviceAgentId,
    agent?.serverUrl,
    agent?.username,
    agent?.password,
    workspaceId,
    writable,
    mcp,
    wrapMcp,
    mcpServers,
  ]);

  /**
   * Move the bridge entry to the session the user just opened.
   *
   * The connection is not restarted: `registerEntry` only replaces the OpenCode entry, so one
   * bridge exists at any time and it always belongs to the visible session. A failure leaves the
   * previous entry in place and says so, because a silent failure would look like a bridge that
   * works but whose tools are denied.
   */
  useEffect(() => {
    const target = sessionId ? bridgeMcpName(sessionId) : "";
    if (!target || !entryName || entryName === target) return;
    const register = registerEntryRef.current;
    if (!register) return;
    void register(sessionId as string, entryName)
      // The wrapped proxies are named after the session too, so they move with the bridge
      // entry. Their tools are only usable by the session that owns the entry.
      .then(() => registerWrappedRef.current?.(sessionId as string))
      .catch((reason) => {
        notifyRef.current(
          tRef.current("agents.bridge.rescope_failed", {
            message: reason instanceof Error ? reason.message : String(reason),
          }),
        );
      });
    // `entryName` belongs in the dependencies: the move sets it, and the guard above then stops.
  }, [agent?.id, sessionId, entryName]);

  return {
    status,
    error,
    tabAway,
    unavailable,
    entryName,
    wrappedEntries,
    wrappedFailed,
  };
}
