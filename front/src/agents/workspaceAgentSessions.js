import {
  attachWorkspaceAgentSession,
  detachWorkspaceAgentSession,
  hasWorkspaceAgentLink,
} from "../db/workspaceDb";
import {
  buildSessionTree,
  createAgentSession,
  notifyAgentSessionsChanged,
  switchAgentSession,
} from "./agentSessions";

// Sessions are attached per (workspace, agent) pair. These helpers keep the filtering and the
// attach/create flow in one place so the workspace page, the chat sidebar and the agent list
// all show the same subset of an agent's sessions.

const parentIdOf = (session) => session?.parentID || session?.parentId || null;

/**
 * Sessions in `ids`, their whole subtree (subagent sessions belong to their root) and their
 * ancestors (so an attached child still renders under its parent).
 */
const expandSessionIds = (tree, ids) => {
  const byId = new Map((tree?.all || []).map((session) => [session.id, session]));
  const childrenOf = new Map();
  for (const session of tree?.all || []) {
    const parentId = parentIdOf(session);
    if (!parentId) continue;
    const list = childrenOf.get(parentId) || [];
    list.push(session);
    childrenOf.set(parentId, list);
  }
  const kept = new Set();
  const addSubtree = (session) => {
    if (!session || kept.has(session.id)) return;
    kept.add(session.id);
    for (const child of childrenOf.get(session.id) || []) addSubtree(child);
  };
  for (const id of ids || []) {
    let session = byId.get(id);
    while (session && !kept.has(session.id)) {
      addSubtree(session);
      const parentId = parentIdOf(session);
      session = parentId ? byId.get(parentId) : null;
    }
  }
  return { byId, kept };
};

export const workspaceSessionIds = (links, workspaceId, agentId) => {
  const ids = new Set();
  for (const link of links || []) {
    if (link?.workspaceId === workspaceId && link?.agentId === agentId) {
      ids.add(link.sessionId);
    }
  }
  return ids;
};

export const agentWorkspaceSessionIds = (links, agentId) => {
  const ids = new Set();
  for (const link of links || []) {
    if (link?.agentId === agentId) ids.add(link.sessionId);
  }
  return ids;
};

export const agentWorkspaceIds = (links, agentId) => {
  const ids = [];
  for (const link of links || []) {
    if (link?.agentId === agentId && !ids.includes(link.workspaceId)) {
      ids.push(link.workspaceId);
    }
  }
  return ids;
};

/**
 * Keep the sessions in `ids` with their subtrees and ancestors, so an attached session keeps
 * its subagent sessions and an attached subagent session still renders under its parent.
 * `ids` may be null to mean "every session".
 */
export const filterSessionTree = (tree, ids) => {
  if (!tree || !ids) return tree;
  const { byId, kept } = expandSessionIds(tree, ids);
  const filtered = buildSessionTree(
    [...kept].map((id) => byId.get(id)).filter(Boolean),
  );
  // Keep the "this list came from the cache" marker of the unfiltered tree.
  return tree.offline ? { ...filtered, offline: true } : filtered;
};

/**
 * Sessions of an agent that no workspace of that agent shows, directly or through a parent.
 * They stay reachable in the sidebar's "not in a workspace" group.
 */
export const unassignedSessionIds = (tree, links, agentId) => {
  if (!tree) return new Set();
  const linked = agentWorkspaceSessionIds(links, agentId);
  const { kept } = expandSessionIds(tree, linked);
  const ids = new Set();
  for (const session of tree.all || []) {
    if (!kept.has(session.id)) ids.add(session.id);
  }
  return ids;
};

/** Attach a session to a workspace and make it the agent's active session. */
export async function openWorkspaceAgentSession(workspaceId, agent, session) {
  if (!agent?.id || !session?.id) return;
  if (
    workspaceId &&
    (await hasWorkspaceAgentLink(workspaceId, agent.id))
  ) {
    await attachWorkspaceAgentSession(workspaceId, agent.id, session.id);
  }
  switchAgentSession(agent, session.id);
}

/** Create a session for an agent inside a workspace, so it is attached there right away. */
export async function createWorkspaceAgentSession(workspaceId, agent) {
  const session = await createAgentSession(agent);
  if (
    workspaceId &&
    agent?.id &&
    session?.id &&
    (await hasWorkspaceAgentLink(workspaceId, agent.id))
  ) {
    await attachWorkspaceAgentSession(workspaceId, agent.id, session.id);
  }
  notifyAgentSessionsChanged(agent.id);
  return session;
}

export async function detachSessionFromWorkspace(workspaceId, agent, session) {
  if (!workspaceId || !agent?.id || !session?.id) return;
  await detachWorkspaceAgentSession(workspaceId, agent.id, session.id);
}
