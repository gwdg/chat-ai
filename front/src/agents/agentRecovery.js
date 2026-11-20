import {
  createOpencodeSession,
  deleteOpencodeSession,
  listOpencodeSessions,
  putOpencodeInstructionEntry,
} from "../apis/opencodeAgents";
import {
  loadAgentSessions,
  loadAgentSessionMessages,
  loadCachedAgentSessionIds,
  removeAgentSessionCache,
  saveAgentSessionMessages,
  saveAgentSessions,
} from "../db/agentSessionCache";
import i18n from "../i18n";
import { renameWorkspaceAgentSession } from "../db/workspaceDb";
import { buildAgentHistoryRestoreText } from "./agentHistoryExport";
import { getAgent, updateAgent } from "./agentStore";
import {
  notifyAgentSessionsChanged,
  switchAgentSession,
} from "./agentSessions";

// A reachable agent server can lose its sessions (a reinstall, a different data directory or a
// restart without persistence). The local cache then still knows the sessions, so the missing
// ones can be recreated and the transcripts written into their instructions.

const sessionTime = (session) =>
  Number(session?.time?.updated ?? session?.time?.created ?? 0);

const sessionTitle = (agent, session) =>
  String(session?.title || "").trim() ||
  i18n.t("agents.restore_session_title", {
    name: agent?.name || "Agent",
  });

/**
 * Compare the agent's server sessions with the local cache. `reachable` is false only when the
 * session list itself failed; `missing` holds cached sessions the server no longer reports and
 * that still have a cached transcript.
 */
export async function inspectAgentRecovery(agent) {
  const result = {
    reachable: false,
    reason: null,
    serverSessions: [],
    missing: [],
    currentMissing: false,
  };
  if (!agent?.id) return result;

  let listed;
  try {
    listed = await listOpencodeSessions(agent);
  } catch (reason) {
    result.reason = reason;
    return result;
  }
  result.reachable = true;
  result.serverSessions = Array.isArray(listed) ? listed : [];
  const serverIds = new Set(result.serverSessions.map((session) => session?.id));
  const [cached, cachedIds] = await Promise.all([
    loadAgentSessions(agent.id).catch(() => []),
    loadCachedAgentSessionIds(agent.id).catch(() => []),
  ]);
  const metadata = new Map(
    cached.filter((session) => session?.id).map((session) => [session.id, session]),
  );
  for (const sessionId of cachedIds) {
    if (!sessionId || serverIds.has(sessionId)) continue;
    const history = await loadAgentSessionMessages(agent.id, sessionId).catch(
      () => null,
    );
    if (!history?.messages?.length) continue;
    result.missing.push({
      session: metadata.get(sessionId) || { id: sessionId },
      messageCount: history.messages.length,
      syncedAt: history.syncedAt,
    });
  }
  result.missing.sort(
    (left, right) => sessionTime(left.session) - sessionTime(right.session),
  );
  result.currentMissing = result.missing.some(
    (entry) => entry.session.id === agent.sessionId,
  );
  return result;
}

/**
 * Recreate every missing session on the server and write its cached transcript into the new
 * session's instructions. Returns `{ from, to, title }` for each restored session.
 */
export async function restoreCachedSessions(agent, missing = []) {
  if (!agent?.id) throw new Error("An agent is required to restore sessions.");
  const entries = (Array.isArray(missing) ? missing : []).filter(
    (entry) => entry?.session?.id,
  );
  const restored = [];
  let nextSessionId = agent.sessionId || null;

  for (const entry of entries) {
    const original = entry.session;
    const history = await loadAgentSessionMessages(agent.id, original.id);
    if (!history.messages.length) continue;

    const created = await createOpencodeSession(
      agent,
      sessionTitle(agent, original),
    );
    if (!created?.id) {
      throw new Error(i18n.t("agents.restore_failed"));
    }
    try {
      const text = buildAgentHistoryRestoreText({
        agent: { ...agent, sessionId: original.id },
        messages: history.messages,
        cachedAt: history.syncedAt,
      });
      await putOpencodeInstructionEntry(
        agent,
        created.id,
        "chat-ai-restored-history",
        text,
      );
      // Keep the transcript visible locally; the server timeline starts empty.
      await saveAgentSessionMessages(agent.id, created.id, history.messages, {
        replace: true,
        lastMessageId: history.lastMessageId,
        restoredFrom: original.id,
      });
      await saveAgentSessions(agent.id, [
        {
          ...original,
          ...created,
          title: created.title || original.title,
          restoredFrom: original.id,
        },
      ]);
      await renameWorkspaceAgentSession(agent.id, original.id, created.id);
      // Drop the old cache entry so the same session is not offered again next time.
      await removeAgentSessionCache(agent.id, original.id);
    } catch (reason) {
      await deleteOpencodeSession(agent, created.id).catch(() => {});
      throw reason;
    }

    if (agent.sessionId === original.id) nextSessionId = created.id;
    restored.push({
      from: original.id,
      to: created.id,
      title: created.title || original.title || "",
    });
  }

  if (!nextSessionId && restored.length) {
    nextSessionId = restored[restored.length - 1].to;
  }
  if (restored.length) {
    const current = getAgent(agent.id) || agent;
    const summaries = { ...(current.sessionSummaries || {}) };
    for (const item of restored) {
      if (summaries[item.from]) {
        summaries[item.to] = summaries[item.from];
        delete summaries[item.from];
      }
    }
    const patch = { sessionSummaries: summaries };
    if (
      current.initialMessageSessionId &&
      restored.some((item) => item.from === current.initialMessageSessionId)
    ) {
      patch.initialMessageSessionId =
        restored.find(
          (item) => item.from === current.initialMessageSessionId,
        )?.to || current.initialMessageSessionId;
    }
    updateAgent(agent.id, patch);
    if (nextSessionId && nextSessionId !== agent.sessionId) {
      switchAgentSession(agent, nextSessionId);
    }
    notifyAgentSessionsChanged(agent.id);
  }
  return restored;
}
