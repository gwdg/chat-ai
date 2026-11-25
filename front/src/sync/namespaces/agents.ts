import {
  applyAgentFromSync,
  getAgents,
  addAgent,
  removeAgent,
} from "../../agents/agentStore";
import { canonicalJson, hashPayload } from "../canonical";
import type { ApplyContext, LocalRecord, RemoteRecord, SyncNamespace } from "../types";
import {
  readAgentSessionCacheForSync,
  writeAgentSessionCacheForSync,
} from "../../db/syncAdapters";

/**
 * Agents are local metadata plus a cached OpenCode history. The record carries
 * the connection and the cached sessions, so a second device can read a
 * conversation that happened on this one while the agent server is down.
 *
 * Histories are bounded: a chatty session keeps its newest messages, and a
 * record that is still too large drops its histories rather than blocking the
 * sync. The agent itself is never dropped for size.
 */
const MAX_SESSIONS = 50;
const MAX_MESSAGES_PER_SESSION = 300;
const MAX_RECORD_BYTES = 4 * 1024 * 1024;
const CONFLICT_SUFFIX = " (conflict copy)";

/** Per-device view state that must not follow the account. */
const DEVICE_ONLY_FIELDS = new Set(["sessionId"]);

const agentPayload = (agent: any) => {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(agent ?? {})) {
    if (DEVICE_ONLY_FIELDS.has(key)) continue;
    out[key] = value;
  }
  return out;
};

export function createAgentsNamespace(): SyncNamespace {
  let skipped: string[] = [];

  return {
    name: "agents",
    async list(): Promise<LocalRecord[]> {
      skipped = [];
      const records: LocalRecord[] = [];
      for (const agent of getAgents()) {
        const cache = await readAgentSessionCacheForSync(agent.id);
        const sessions = cache.sessions.slice(0, MAX_SESSIONS);
        const allowed = new Set(sessions.map((session) => session.sessionId));
        const histories = cache.histories
          .filter((history) => allowed.has(history.sessionId))
          .map((history) => ({
            sessionId: history.sessionId,
            messages: history.messages.slice(-MAX_MESSAGES_PER_SESSION),
          }));

        let payload: any = {
          id: agent.id,
          agent: agentPayload(agent),
          sessions,
          histories,
        };
        if (canonicalJson(payload).length > MAX_RECORD_BYTES) {
          skipped.push(`${agent.name || agent.id}: session histories too large`);
          payload = { id: agent.id, agent: agentPayload(agent), sessions, histories: [] };
        }
        records.push({
          namespace: "agents",
          id: agent.id,
          hash: hashPayload(payload),
          payload,
          title: agent.name || agent.id,
        });
      }
      return records;
    },
    async apply(record: RemoteRecord) {
      const payload = record.payload ?? {};
      const agent = payload.agent;
      if (!agent?.id) return;
      // Keeps the record's `updatedAt`: a pull must not look like a local edit.
      applyAgentFromSync(agentPayload(agent));
      await writeAgentSessionCacheForSync(
        agent.id,
        payload.sessions ?? [],
        payload.histories ?? [],
      );
    },
    async remove(id: string) {
      removeAgent(id);
    },
    async duplicate(record: RemoteRecord, ctx: ApplyContext) {
      const payload = record.payload ?? {};
      const agent = payload.agent ?? {};
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${record.id}-conflict-${Date.now()}`;
      addAgent({
        ...agentPayload(agent),
        id,
        name: `${agent.name || "Agent"}${CONFLICT_SUFFIX}`,
      });
      await writeAgentSessionCacheForSync(
        id,
        payload.sessions ?? [],
        payload.histories ?? [],
      );
      void ctx;
    },
    titleOf(payload: any) {
      return String(payload?.agent?.name ?? "Agent");
    },
    takeSkipped() {
      const out = skipped;
      skipped = [];
      return out;
    },
  };
}
