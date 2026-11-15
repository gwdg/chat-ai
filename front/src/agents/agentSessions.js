import {
  createOpencodeSession,
  deleteOpencodeSession,
  listOpencodeSessionChildren,
  listOpencodeSessions,
} from "../apis/opencodeAgents";
import { updateAgent } from "./agentStore";
import { removeWorkspaceAgentSessionLinks } from "../db/workspaceDb";

const sessionTime = (session) =>
  Number(session?.time?.updated ?? session?.time?.created ?? 0);

const byRecent = (left, right) => sessionTime(right) - sessionTime(left);

export const sessionLabel = (session, fallback = "Session") =>
  String(session?.title || session?.id || fallback).trim();

export const sessionSummariesFor = (agent) => {
  const summaries = { ...(agent?.sessionSummaries || {}) };
  if (agent?.summary && agent?.sessionId && !summaries[agent.sessionId]) {
    summaries[agent.sessionId] = {
      summary: agent.summary,
      sourceHash: agent.summarySourceHash,
      updatedAt: agent.summaryUpdatedAt,
    };
  }
  return summaries;
};

export const buildSessionTree = (sessions = []) => {
  const unique = new Map();
  for (const session of sessions) {
    if (session?.id) unique.set(session.id, session);
  }
  const all = [...unique.values()].sort(byRecent);
  const children = new Map();
  const roots = [];
  for (const session of all) {
    const parentId = session.parentID || session.parentId;
    if (parentId) {
      const list = children.get(parentId) || [];
      list.push(session);
      children.set(parentId, list);
    } else {
      roots.push(session);
    }
  }
  for (const list of children.values()) list.sort(byRecent);
  return { roots, children, all };
};

export async function fetchAgentSessions(agent) {
  const listed = await listOpencodeSessions(agent);
  const sessions = new Map();
  for (const session of Array.isArray(listed) ? listed : []) {
    if (session?.id) sessions.set(session.id, session);
  }

  const queue = [...sessions.values()].filter(
    (session) => !(session.parentID || session.parentId),
  );
  const visited = new Set();
  let requests = 0;
  while (queue.length && requests < 80) {
    const parent = queue.shift();
    if (!parent?.id || visited.has(parent.id)) continue;
    visited.add(parent.id);
    requests += 1;
    const children = await listOpencodeSessionChildren(
      agent,
      parent.id,
    ).catch(() => []);
    for (const child of Array.isArray(children) ? children : []) {
      if (!child?.id) continue;
      const normalized = {
        ...child,
        parentID: child.parentID || child.parentId || parent.id,
      };
      sessions.set(child.id, normalized);
      if (!visited.has(child.id)) queue.push(normalized);
    }
  }

  return buildSessionTree([...sessions.values()]);
}

export async function createAgentSession(agent, title) {
  const session = await createOpencodeSession(
    agent,
    title || `${agent.name || "Agent"} session`,
  );
  if (session?.id) updateAgent(agent.id, { sessionId: session.id });
  return session;
}

export async function deleteAgentSession(agent, session, tree = null) {
  if (!agent?.id || !session?.id) return null;
  await deleteOpencodeSession(agent, session.id);
  await removeWorkspaceAgentSessionLinks(agent.id, session.id);
  let nextSession = null;
  if (agent.sessionId === session.id) {
    const source = tree || (await fetchAgentSessions(agent));
    const roots = source?.roots || [];
    const all = source?.all || [];
    nextSession =
      roots.find((item) => item.id !== session.id) ||
      all.find((item) => item.id !== session.id) ||
      null;
    if (nextSession) switchAgentSession(agent, nextSession.id);
    else await createAgentSession(agent);
  }
  notifyAgentSessionsChanged(agent.id);
  return nextSession;
}

export function switchAgentSession(agent, sessionId) {
  if (!sessionId) return;
  updateAgent(agent.id, { sessionId });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("chatai:agent-session-changed", {
        detail: { agentId: agent.id, sessionId },
      }),
    );
  }
}

export function notifyAgentSessionsChanged(agentId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("chatai:agent-sessions-changed", {
      detail: { agentId },
    }),
  );
}
