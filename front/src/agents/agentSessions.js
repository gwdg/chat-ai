import {
  createOpencodeSession,
  deleteOpencodeSession,
  listOpencodeMessages,
  listOpencodeMessagesPage,
  listOpencodeSessionChildren,
  listOpencodeSessions,
} from "../apis/opencodeAgents";
import { updateAgent } from "./agentStore";
import { removeWorkspaceAgentSessionLinks } from "../db/workspaceDb";
import {
  loadAgentSessions,
  removeAgentSessionCache,
  saveAgentSessions,
} from "../db/agentSessionCache";

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

/**
 * Combine cached messages with a freshly downloaded tail. `newestId` is the last message we
 * already had; OpenCode returns that anchor plus everything newer. `complete` is true when the
 * download reached the start of the server history, so a missing anchor then means the history
 * was rewritten (clear, revert, compaction), not that the page window ended early.
 */
export const mergeMessageHistory = (
  cached = [],
  fetched = [],
  newestId = null,
  complete = true,
) => {
  const previous = Array.isArray(cached) ? cached : [];
  const next = Array.isArray(fetched) ? fetched : [];
  if (!next.length) {
    return previous.length
      ? {
          messages: previous,
          startIndex: previous.length,
          changed: [],
          replace: false,
          needsFullHistory: false,
        }
      : {
          messages: [],
          startIndex: 0,
          changed: [],
          replace: true,
          needsFullHistory: false,
        };
  }
  if (!previous.length) {
    return {
      messages: next,
      startIndex: 0,
      changed: next,
      replace: true,
      needsFullHistory: false,
    };
  }
  const anchorId = newestId || previous[previous.length - 1]?.id;
  const fetchedIndex = anchorId
    ? next.findIndex((message) => message?.id === anchorId)
    : -1;
  if (fetchedIndex >= 0) {
    const cachedIndex = previous.findIndex(
      (message) => message?.id === anchorId,
    );
    const prefix =
      cachedIndex >= 0
        ? previous.slice(0, cachedIndex)
        : previous.slice(0, previous.length - 1);
    return {
      messages: [...prefix, ...next.slice(fetchedIndex)],
      startIndex: prefix.length,
      changed: next.slice(fetchedIndex),
      replace: false,
      needsFullHistory: false,
    };
  }
  if (!complete) {
    // The window ends before the cached anchor. Keep the cache untouched and re-read the whole
    // history; appending across the gap would silently hide the messages in between.
    return {
      messages: previous,
      startIndex: previous.length,
      changed: [],
      replace: false,
      needsFullHistory: true,
    };
  }
  return {
    messages: next,
    startIndex: 0,
    changed: next,
    replace: true,
    needsFullHistory: false,
  };
};

/** Age after which a cached history is re-read in full and reconciled by id. */
export const CACHE_REVALIDATE_MS = 24 * 60 * 60 * 1000;

/**
 * Reconcile the cached history with the agent server. Returns the timeline to show plus what
 * `saveAgentSessionMessages` has to persist.
 *
 * The server is authoritative once it answers: if the cached anchor is gone, the history was
 * rewritten and the download replaces the cache instead of being stitched onto it. An empty
 * answer is confirmed with a full read first, so one empty page can never wipe the cache. A
 * full read (`full: true`, a stale cache or a compaction) re-reads everything and reconciles
 * by id. Network errors propagate, and the caller keeps the cache.
 */
export async function syncSessionHistory(
  agent,
  sessionId,
  cached = [],
  newestId = null,
  options = {},
) {
  const previous = Array.isArray(cached) ? cached : [];
  const result = (merged, messages) => ({
    ...merged,
    lastMessageId: messages.length
      ? (messages[messages.length - 1]?.id ?? null)
      : null,
  });
  if (!sessionId) {
    return result(
      {
        messages: [],
        startIndex: 0,
        changed: [],
        replace: false,
        needsFullHistory: false,
      },
      [],
    );
  }

  if (options.full === true) {
    const messages = await listOpencodeMessages(agent, sessionId);
    if (options.keepWhenEmpty === true && !messages.length && previous.length) {
      return result(
        {
          messages: previous,
          startIndex: previous.length,
          changed: [],
          replace: false,
          needsFullHistory: false,
        },
        previous,
      );
    }
    // Replacing from an empty cache drops messages the server no longer has (middle edits,
    // compaction), which a prefix merge would keep.
    return result(mergeMessageHistory([], messages, null, true), messages);
  }

  const page = await listOpencodeMessagesPage(agent, sessionId, { newestId });
  const merged = mergeMessageHistory(
    previous,
    page.messages,
    newestId,
    page.complete,
  );
  if (!merged.needsFullHistory && page.messages.length) {
    return result(merged, page.messages);
  }

  // Either the anchor is gone or the page came back empty. Confirm against the whole history
  // before changing anything, so a partial answer cannot truncate or wipe the cache.
  const messages = await listOpencodeMessages(agent, sessionId);
  if (options.keepWhenEmpty === true && !messages.length && previous.length) {
    return result(
      {
        messages: previous,
        startIndex: previous.length,
        changed: [],
        replace: false,
        needsFullHistory: false,
      },
      previous,
    );
  }
  return result(mergeMessageHistory([], messages, null, true), messages);
}

export async function fetchAgentSessions(agent) {
  let listed;
  try {
    listed = await listOpencodeSessions(agent);
  } catch (reason) {
    // The agent server is unreachable. Fall back to the session list from the local cache
    // so an already downloaded conversation can still be opened.
    const cached = await loadAgentSessions(agent?.id).catch(() => []);
    if (cached.length) {
      return { ...buildSessionTree(cached), offline: true };
    }
    throw reason;
  }
  const sessions = new Map();
  for (const session of Array.isArray(listed) ? listed : []) {
    if (session?.id) sessions.set(session.id, session);
  }

  const queue = [...sessions.values()].filter(
    (session) => !(session.parentID || session.parentId),
  );
  const visited = new Set();
  let requests = 0;
  // Only a listing that reached every session may prune the cache.
  let complete = Array.isArray(listed);
  while (queue.length && requests < 80) {
    const parent = queue.shift();
    if (!parent?.id || visited.has(parent.id)) continue;
    visited.add(parent.id);
    requests += 1;
    const children = await listOpencodeSessionChildren(agent, parent.id).catch(
      () => {
        complete = false;
        return [];
      },
    );
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
  if (queue.length) complete = false;

  const tree = buildSessionTree([...sessions.values()]);
  if (agent?.id) {
    // An empty agent (fresh data directory, lost sessions) must not erase the cache: it is
    // the only copy left and the recovery offer restores it.
    const cached = await loadAgentSessions(agent.id).catch(() => []);
    const prune = complete && (tree.all.length > 0 || cached.length === 0);
    await saveAgentSessions(agent.id, tree.all, { prune }).catch(() => {});
  }
  return tree;
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
  await removeAgentSessionCache(agent.id, session.id).catch(() => {});
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

/**
 * Announce that the server rewrote a session's messages in place (revert, clear revert).
 * The open conversation re-reads the history in full, because the change is not a new tail.
 */
export function notifyAgentHistoryChanged(agent, sessionId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("chatai:agent-history-changed", {
      detail: { agentId: agent?.id, sessionId },
    }),
  );
}
