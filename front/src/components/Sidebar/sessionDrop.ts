import {
  attachWorkspaceAgent,
  attachWorkspaceAgentSession,
  detachWorkspaceAgentSession,
} from "../../db/workspaceDb";

// A dragged agent session carries its agent and session ids under a private
// type, so a workspace row only accepts the sidebar's own session drags — not
// files, text or a browser tab.
export const AGENT_SESSION_DRAG_MIME = "application/x-chatai-agent-session";
// Present only when the row was dragged out of a workspace and holds that
// workspace's id. Dropping it on another workspace moves the session link.
export const AGENT_SESSION_SOURCE_WORKSPACE_MIME =
  "application/x-chatai-agent-session-workspace";

export type AgentSessionDrag = {
  agentId: string;
  sessionId: string;
  workspaceId: string | null;
};

const encodePayload = (agentId: string, sessionId: string) =>
  JSON.stringify({ agentId, sessionId });

// While a drag is in flight over a drop target the browser hides `getData()`, so a
// target cannot read the payload's agent until the drop itself. The sidebar's own
// drags record their payload here when they start, which lets a target decide while
// the pointer is still moving whether it accepts this drag at all.
let activeDrag: AgentSessionDrag | null = null;

export const getActiveAgentSessionDrag = (): AgentSessionDrag | null =>
  activeDrag;

export function clearAgentSessionDrag() {
  activeDrag = null;
}

export function setAgentSessionDragData(
  dataTransfer: DataTransfer | null,
  agentId: string,
  sessionId: string,
  workspaceId: string | null = null,
) {
  if (!dataTransfer || !agentId || !sessionId) return;
  activeDrag = { agentId, sessionId, workspaceId };
  // text/plain keeps the session id readable for generic handlers; the private
  // types decide who lights up as a drop target.
  dataTransfer.setData("text/plain", sessionId);
  dataTransfer.setData(
    AGENT_SESSION_DRAG_MIME,
    encodePayload(agentId, sessionId),
  );
  if (workspaceId) {
    dataTransfer.setData(AGENT_SESSION_SOURCE_WORKSPACE_MIME, workspaceId);
  }
  dataTransfer.effectAllowed = "move";
}

export function isAgentSessionDrag(
  dataTransfer: DataTransfer | null,
): boolean {
  const types = dataTransfer?.types;
  if (!types) return false;
  return Array.prototype.includes.call(types, AGENT_SESSION_DRAG_MIME);
}

export function readAgentSessionDrag(
  dataTransfer: DataTransfer | null,
): AgentSessionDrag | null {
  if (!dataTransfer) return null;
  const raw = dataTransfer.getData(AGENT_SESSION_DRAG_MIME);
  if (!raw) return null;
  let parsed: { agentId?: unknown; sessionId?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const agentId = typeof parsed?.agentId === "string" ? parsed.agentId : "";
  const sessionId =
    typeof parsed?.sessionId === "string" ? parsed.sessionId : "";
  if (!agentId || !sessionId) return null;
  return {
    agentId,
    sessionId,
    workspaceId:
      dataTransfer.getData(AGENT_SESSION_SOURCE_WORKSPACE_MIME) || null,
  };
}

/**
 * Dropping a session on a workspace row attaches it. A row dragged out of
 * another workspace is detached from it first, so the drop moves the link
 * instead of adding a second one.
 *
 * A workspace only lists sessions of agents it already contains, so the drop
 * also links the agent when the target workspace does not know it yet;
 * otherwise the session link would be written and never shown.
 */
export async function dropAgentSessionOnWorkspace({
  agentId,
  sessionId,
  targetWorkspaceId,
  sourceWorkspaceId,
}: {
  agentId: string;
  sessionId: string;
  targetWorkspaceId: string;
  sourceWorkspaceId?: string | null;
}) {
  if (!agentId || !sessionId || !targetWorkspaceId) return;
  if (sourceWorkspaceId && sourceWorkspaceId !== targetWorkspaceId) {
    await detachWorkspaceAgentSession(
      sourceWorkspaceId,
      agentId,
      sessionId,
    );
  }
  await attachWorkspaceAgent(targetWorkspaceId, agentId);
  await attachWorkspaceAgentSession(targetWorkspaceId, agentId, sessionId);
}
