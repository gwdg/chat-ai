import { db } from "./index";

import type { AgentSessionMessageRow, AgentSessionRow } from "./dbTypes";

// Local cache of OpenCode session history. Reading it first makes re-opening a session
// instant and keeps the conversation readable while the agent server is unreachable.
// Raw table access stays in this module; callers use the functions below.

const now = () => Date.now();

const sessionKey = (agentId: string, sessionId: string) =>
  `${agentId}:${sessionId}`;

const messageKey = (agentId: string, sessionId: string, messageId: string) =>
  `${agentId}:${sessionId}:${messageId}`;

const messageIdOf = (message: any, fallback: string) =>
  String(message?.id ?? fallback);

export type CachedAgentSessionMessages = {
  messages: any[];
  lastMessageId: string | null;
  syncedAt: number | null;
};

export async function loadAgentSessionMessages(
  agentId?: string,
  sessionId?: string,
): Promise<CachedAgentSessionMessages> {
  if (!agentId || !sessionId) {
    return { messages: [], lastMessageId: null, syncedAt: null };
  }
  const [rows, meta] = await Promise.all([
    db.agent_session_messages
      .where("[agentId+sessionId]")
      .equals([agentId, sessionId])
      .toArray(),
    db.agent_sessions
      .where("[agentId+sessionId]")
      .equals([agentId, sessionId])
      .first(),
  ]);
  rows.sort((left, right) => left.position - right.position);
  return {
    messages: rows.map((row) => row.data),
    lastMessageId: meta?.lastMessageId ?? null,
    syncedAt: meta?.messagesSyncedAt ?? null,
  };
}

export type SaveAgentSessionMessagesOptions = {
  /** Index of the first message in the complete history. */
  startIndex?: number;
  /** Replace the cached history instead of updating it in place. */
  replace?: boolean;
  lastMessageId?: string | null;
  syncedAt?: number;
};

/**
 * Store the messages that were just downloaded. On a poll this is only the changed tail,
 * so a long session is not structured-cloned in full every second.
 */
export async function saveAgentSessionMessages(
  agentId: string,
  sessionId: string,
  messages: any[],
  options: SaveAgentSessionMessagesOptions = {},
): Promise<void> {
  if (!agentId || !sessionId) return;
  const list = Array.isArray(messages) ? messages : [];
  const startIndex = Number.isFinite(options.startIndex)
    ? Number(options.startIndex)
    : 0;
  const replace = options.replace === true;
  const syncedAt = options.syncedAt ?? now();
  const rows: AgentSessionMessageRow[] = list.map((data, offset) => ({
    id: messageKey(agentId, sessionId, messageIdOf(data, `${startIndex + offset}`)),
    agentId,
    sessionId,
    messageId: messageIdOf(data, `${startIndex + offset}`),
    position: startIndex + offset,
    data,
    updatedAt: syncedAt,
  }));

  await db.transaction(
    "rw",
    [db.agent_session_messages, db.agent_sessions],
    async () => {
      if (replace) {
        await db.agent_session_messages
          .where("[agentId+sessionId]")
          .equals([agentId, sessionId])
          .delete();
        if (rows.length) await db.agent_session_messages.bulkPut(rows);
      } else if (rows.length) {
        const existing = await db.agent_session_messages.bulkGet(
          rows.map((row) => row.id),
        );
        const changed = rows.filter((row, index) => {
          const previous = existing[index];
          return (
            !previous ||
            previous.position !== row.position ||
            JSON.stringify(previous.data) !== JSON.stringify(row.data)
          );
        });
        if (changed.length) await db.agent_session_messages.bulkPut(changed);
        // A message removed from the server must not linger at the end of the cache.
        await db.agent_session_messages
          .where("[agentId+sessionId+position]")
          .aboveOrEqual([agentId, sessionId, startIndex + rows.length])
          .delete();
      }

      const previousMeta = await db.agent_sessions
        .where("[agentId+sessionId]")
        .equals([agentId, sessionId])
        .first();
      const lastMessage = [...list]
        .reverse()
        .find((message) => message?.type !== "shell");
      const messageCount = replace
        ? list.length
        : Math.max(previousMeta?.messageCount ?? 0, startIndex + list.length);
      const meta: AgentSessionRow = {
        id: sessionKey(agentId, sessionId),
        agentId,
        sessionId,
        data: previousMeta?.data ?? null,
        ...previousMeta,
        updatedAt: syncedAt,
        messagesSyncedAt: syncedAt,
        lastMessageId: replace
          ? (lastMessage?.id ?? null)
          : (options.lastMessageId ??
            lastMessage?.id ??
            previousMeta?.lastMessageId ??
            null),
        messageCount: replace ? list.length : messageCount,
      };
      await db.agent_sessions.put(meta);
    },
  );
}

/**
 * Cache the session metadata returned by `fetchAgentSessions`. With `prune`, sessions the
 * server no longer reports (and their cached history) are dropped, so a session deleted
 * elsewhere does not reappear while offline. Only pass `prune` for a complete listing.
 */
export async function saveAgentSessions(
  agentId: string,
  sessions: any[],
  options: { prune?: boolean } = {},
): Promise<void> {
  if (!agentId) return;
  const list = (Array.isArray(sessions) ? sessions : []).filter(
    (session) => session?.id,
  );
  const prune = options.prune === true;
  if (!list.length && !prune) return;
  await db.transaction(
    "rw",
    [db.agent_sessions, db.agent_session_messages],
    async () => {
      const existing = await db.agent_sessions
        .where("agentId")
        .equals(agentId)
        .toArray();
      const bySession = new Map(existing.map((row) => [row.sessionId, row]));
      const updatedAt = now();
      const rows: AgentSessionRow[] = list.map((session) => {
        const previous = bySession.get(session.id);
        return {
          id: sessionKey(agentId, session.id),
          agentId,
          sessionId: session.id,
          ...previous,
          data: session,
          updatedAt,
        };
      });
      if (rows.length) await db.agent_sessions.bulkPut(rows);
      if (prune) {
        const keep = new Set(list.map((session) => session.id));
        const removed = existing.filter((row) => !keep.has(row.sessionId));
        for (const row of removed) {
          await db.agent_session_messages
            .where("[agentId+sessionId]")
            .equals([agentId, row.sessionId])
            .delete();
        }
        if (removed.length) {
          await db.agent_sessions.bulkDelete(removed.map((row) => row.id));
        }
      }
    },
  );
}

export async function loadAgentSessions(agentId?: string): Promise<any[]> {
  if (!agentId) return [];
  const rows = await db.agent_sessions
    .where("agentId")
    .equals(agentId)
    .toArray();
  return rows.map((row) => row.data).filter(Boolean);
}

export async function removeAgentSessionCache(
  agentId: string,
  sessionId: string,
): Promise<void> {
  if (!agentId || !sessionId) return;
  await db.transaction(
    "rw",
    [db.agent_session_messages, db.agent_sessions],
    async () => {
      await db.agent_session_messages
        .where("[agentId+sessionId]")
        .equals([agentId, sessionId])
        .delete();
      await db.agent_sessions
        .where("[agentId+sessionId]")
        .equals([agentId, sessionId])
        .delete();
    },
  );
}

export async function removeAgentSessionCacheForAgent(
  agentId: string,
): Promise<void> {
  if (!agentId) return;
  await db.transaction(
    "rw",
    [db.agent_session_messages, db.agent_sessions],
    async () => {
      await db.agent_session_messages.where("agentId").equals(agentId).delete();
      await db.agent_sessions.where("agentId").equals(agentId).delete();
    },
  );
}
