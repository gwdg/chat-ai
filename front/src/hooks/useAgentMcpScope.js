import { useEffect, useMemo, useState } from "react";

import { applyMcpSessionScope } from "../agents/agentMcpScope";

const idleState = { status: "idle", error: "", updated: [], failed: [] };

/**
 * Keep the injected MCP entries usable only by their own sessions.
 *
 * `entryNames` are the entries this app has registered right now (`chatai-ext-…`,
 * `chatai-bridge-…`), each carrying the session it belongs to. OpenCode's MCP
 * registry is agent-wide, so this is what turns the names into an actual
 * restriction: every session is patched to deny `chatai-*` and to allow exactly
 * the entries that belong to it or to one of its ancestors.
 *
 * Runs again when the entries change (a server connected, the bridge started,
 * the open session moved the entries), on mount, and whenever a session is
 * added, switched or removed — a session that appears after the last run has to
 * be denied too. A failure is reported instead of retried forever: the entries
 * stay usable by their own session, and the next change tries again.
 */
export function useAgentMcpScope({ agent, entryNames }) {
  const [state, setState] = useState(idleState);
  const signature = useMemo(
    () =>
      (Array.isArray(entryNames) ? entryNames : [])
        .filter((name) => typeof name === "string" && name)
        .slice()
        .sort()
        .join("\n"),
    [entryNames],
  );

  useEffect(() => {
    if (!agent?.id) {
      setState(idleState);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setState((current) => ({ ...current, status: "running", error: "" }));
      try {
        const result = await applyMcpSessionScope(agent, {
          entryNames: signature ? signature.split("\n") : [],
        });
        if (cancelled) return;
        setState({
          status: "ready",
          error: "",
          updated: result.updated,
          failed: result.failed,
        });
      } catch (reason) {
        if (cancelled) return;
        setState({
          status: "error",
          error: reason instanceof Error ? reason.message : String(reason),
          updated: [],
          failed: [],
        });
      }
    };
    void run();

    const onSessionsChanged = (event) => {
      const agentId = event?.detail?.agentId;
      // The events carry the agent they concern; another agent's session must not
      // cause a patch round here.
      if (agentId && agentId !== agent.id) return;
      void run();
    };
    window.addEventListener("chatai:agent-sessions-changed", onSessionsChanged);
    window.addEventListener("chatai:agent-session-changed", onSessionsChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(
        "chatai:agent-sessions-changed",
        onSessionsChanged,
      );
      window.removeEventListener(
        "chatai:agent-session-changed",
        onSessionsChanged,
      );
    };
    // Not `[agent]`: a new turn or a rename must not re-patch every session. The
    // connection fields decide whether the patches can reach anything at all.
  }, [
    agent?.id,
    agent?.serviceAgentId,
    agent?.serverUrl,
    agent?.username,
    agent?.password,
    signature,
  ]);

  return state;
}
