import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { selectUserSettings } from "../Redux/reducers/userSettingsReducer";
import {
  injectExternalMcpServers,
  injectableMcpServers,
  removeInjectedMcpServers,
} from "../agents/agentMcpInjection";

const idleState = {
  status: "off",
  injected: [],
  fallback: [],
  error: "",
};

const readGlobalServers = (settings) =>
  Array.isArray(settings?.mcp_servers) ? settings.mcp_servers : [];

/**
 * Keep the natively injectable MCP servers of one agent registered inside its OpenCode.
 *
 * `enabled` is the agent's `bridgeInjectExternal` option on an agent that can run the bridge:
 * with access off there is no second route, so the split would only create entries nobody
 * asked for. The candidates are the configured MCP servers that need no password; each is
 * handed to OpenCode, which connects itself, and the ones it cannot reach stay on the bridge
 * relay.
 *
 * The effect depends on the connection fields and the candidate list, never on `sessionId`:
 * injection is agent-scoped (one OpenCode registry serves all its sessions), so switching
 * sessions must not tear the entries down and re-add them.
 */
export function useAgentMcpInjection({ agent, enabled }) {
  const userSettings = useSelector(selectUserSettings);
  const globalServers = useMemo(
    () => readGlobalServers(userSettings),
    [userSettings],
  );
  const candidates = useMemo(
    () => injectableMcpServers(globalServers),
    [globalServers],
  );
  const [state, setState] = useState(idleState);
  const wasEnabledRef = useRef(false);

  const signature = candidates
    .map((server) => `${server.id}\n${server.url}`)
    .join("\n\n");

  useEffect(() => {
    if (!agent?.id || !enabled) {
      if (!wasEnabledRef.current) return;
      wasEnabledRef.current = false;
      setState(idleState);
      // Switching the option off hands every server back to the bridge relay, so the entries
      // have to go instead of staying in OpenCode as a second, unmanaged route.
      void removeInjectedMcpServers(agent).catch(() => {});
      return;
    }

    wasEnabledRef.current = true;
    let cancelled = false;
    setState((current) => ({
      ...current,
      status: "running",
      error: "",
    }));
    void (async () => {
      try {
        const result = await injectExternalMcpServers(agent, globalServers, {
          isCancelled: () => cancelled,
        });
        if (cancelled) return;
        setState({
          status: "ready",
          injected: result.injected,
          fallback: result.failed,
          error: "",
        });
      } catch (reason) {
        if (cancelled) return;
        setState({
          status: "error",
          injected: [],
          fallback: [],
          error: reason instanceof Error ? reason.message : String(reason),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately not `[agent]`: a session switch only changes `sessionId` and the
    // summaries, and the MCP registry of that agent's OpenCode is shared by all sessions.
  }, [
    agent?.id,
    agent?.serviceAgentId,
    agent?.serverUrl,
    agent?.username,
    agent?.password,
    enabled,
    signature,
  ]);

  return state;
}
