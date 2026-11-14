import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { callMcpServerTool, listMcpServerTools } from "../agent/mcp";
import type { Vfs } from "../agent/vfs";
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

const bridgeBase = () =>
  BACKEND || (typeof window !== "undefined" ? window.location.origin : "");

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
  const [tabAway, setTabAway] = useState(false);

  notifyRef.current = notifyError;
  tRef.current = t;
  providersRef.current = providers;
  mountsRef.current = mounts;
  rootRef.current = rootProvider;

  const mcpServers = useMemo(() => readMcpServers(userSettings), [userSettings]);

  useEffect(() => {
    if (!agent?.id || !workspaceId) {
      setStatus("off");
      setError("");
      return;
    }
    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | null = null;
    let session: any = null;
    let mcpName = "";
    let wasHidden = false;
    const originalTitle = document.title;

    const connectSocket = (url: string) => {
      if (cancelled) return;
      socket = new WebSocket(url);
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
          if (!cancelled) connectSocket(url);
        }, 3000);
      };
      socket.onerror = () => {
        if (!cancelled) setStatus("offline");
      };
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
        socket?.send(
          JSON.stringify({
            type: "tool_result",
            requestId,
            ok: true,
            result,
          }),
        );
      } catch (reason) {
        socket?.send(
          JSON.stringify({
            type: "tool_result",
            requestId,
            ok: false,
            error: reason instanceof Error ? reason.message : String(reason),
          }),
        );
      }
    };

    const start = async () => {
      setStatus("connecting");
      setError("");
      try {
        const response = await fetch(`${bridgeBase()}/bridge/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: agent.id,
            workspaceId,
            writable,
            mcp,
          }),
        });
        if (!response.ok) throw new Error(`Bridge session failed (${response.status})`);
        session = await response.json();
        if (cancelled) return;
        mcpName = `chatai-bridge-${String(session.id).slice(0, 8)}`;
        if (SIDECAR_COMMAND && session.agentWsUrl && session.agentToken) {
          const scopes = [
            "workspace",
            writable ? "write" : "",
            mcp ? "mcp" : "",
          ]
            .filter(Boolean)
            .join(",");
          await addOpencodeMcpServer(agent, mcpName, {
            type: "local",
            command: SIDECAR_COMMAND,
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
        if (!cancelled) connectSocket(session.wsUrl);
      } catch (reason) {
        if (!cancelled) {
          setStatus("error");
          setError(reason instanceof Error ? reason.message : String(reason));
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
      socket?.close();
      if (mcpName) {
        void removeOpencodeMcpServer(agent, mcpName).catch(() => {});
      }
      if (session?.id && session?.token) {
        void fetch(`${bridgeBase()}/bridge/sessions/${session.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.token}` },
        }).catch(() => {});
      }
    };
  }, [agent, workspaceId, writable, mcp, mcpServers]);

  return { status, error, tabAway };
}
