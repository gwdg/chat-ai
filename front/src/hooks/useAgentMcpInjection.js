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
 * Keep the natively injectable MCP servers of one agent registered inside its OpenCode, for the
 * session that is open right now.
 *
 * `enabled` is the agent's `bridgeInjectExternal` option on an agent that can run the bridge:
 * with access off there is no second route, so the split would only create entries nobody
 * asked for. The candidates are the configured MCP servers that need no password; each is
 * handed to OpenCode, which connects itself, and the ones it cannot reach stay on the bridge
 * relay.
 *
 * OpenCode's MCP registry belongs to the instance, not to a session, so `sessionId` is part of
 * every entry name and of this effect: switching sessions hands the entries over to the newly
 * open one (and removes the previous session's), which is what keeps another session of the same
 * agent from using them. `agents/agentMcpScope.js` additionally denies them everywhere else.
 */
export function useAgentMcpInjection({ agent, enabled, sessionId }) {
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
    if (!agent?.id || !enabled || !sessionId) {
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
          sessionId,
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
    // Deliberately not `[agent]`: a new assistant turn or a renamed session must not tear the
    // entries down. `sessionId` is different — the entries carry it, so they move with it.
  }, [
    agent?.id,
    agent?.serviceAgentId,
    agent?.serverUrl,
    agent?.username,
    agent?.password,
    enabled,
    sessionId,
    signature,
  ]);

  return state;
}
