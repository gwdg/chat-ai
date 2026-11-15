import { useLocation } from "react-router";

export type OpenAgent = {
  agentId: string | null;
  sessionId: string | null;
};

const AGENT_PREFIX = "/agent/";

/**
 * The agent view the current route shows. A sidebar must not derive the selected row from
 * `agent.sessionId`: that is the agent's last active session and stays set while the user is
 * in a chat, so it would keep one session highlighted after a reload.
 */
export function parseOpenAgent(pathname: string, search: string): OpenAgent {
  if (!pathname.startsWith(AGENT_PREFIX)) {
    return { agentId: null, sessionId: null };
  }
  const agentId = decodeURIComponent(
    pathname.slice(AGENT_PREFIX.length).split("/")[0],
  );
  return {
    agentId: agentId || null,
    sessionId: new URLSearchParams(search).get("session"),
  };
}

/**
 * The session to highlight for `agent`: the one in the URL when the route opens that agent,
 * otherwise the agent's active session, otherwise nothing.
 */
export function activeSessionIdFor(
  openAgent: OpenAgent,
  agent?: { id?: string; sessionId?: string } | null,
): string | null {
  if (!openAgent?.agentId || openAgent.agentId !== agent?.id) return null;
  return openAgent.sessionId || agent?.sessionId || null;
}

export function useOpenAgent(): OpenAgent {
  const location = useLocation();
  return parseOpenAgent(location.pathname, location.search);
}
