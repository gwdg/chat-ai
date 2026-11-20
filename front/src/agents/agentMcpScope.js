import {
  listOpencodeSessions,
  updateOpencodeSessionPermissions,
} from "../apis/opencodeAgents";

/**
 * Which OpenCode session may use which injected MCP server.
 *
 * OpenCode keeps one MCP registry per instance, so a server registered through
 * the experimental MCP routes is offered to every session of that agent. The
 * only per-session control OpenCode exposes is the permission ruleset of a
 * session (`PATCH /api/session/{id}` with `permissions`), and a `deny` rule
 * removes the tool from the session's tool list entirely (verified against
 * OpenCode 2.3.0: a denied MCP tool disappears, an allowed one stays).
 *
 * Both entries this app registers carry the session they belong to as the end of
 * their name (`chatai-ext-<server>-<sessionId>`, `chatai-bridge-<sessionId>`), so
 * the scope is derived from the names instead of a second registry: a session may
 * use an entry named after itself or after one of its ancestors (a subagent
 * continues its parent's work), and every other entry is denied.
 *
 * Rules are appended after the base and agent rules, and OpenCode applies the
 * last matching rule, which is why a single `deny` overrides the default
 * `{action: "*", resource: "*", effect: "allow"}`.
 */

/** Every entry this app registers starts with this prefix. */
export const CHATAI_ENTRY_PREFIX = "chatai-";

/** Session ids as OpenCode writes them (`ses_…`); they end both entry names. */
export const ENTRY_SESSION_PATTERN = /(ses_[A-Za-z0-9]+)$/;

/** Where the rules this app wrote are remembered, per agent. */
const STORAGE_PREFIX = "chatai.agent-mcp-scope";

export const isChatAiMcpEntry = (name) =>
  typeof name === "string" && name.startsWith(CHATAI_ENTRY_PREFIX);

/** The session an entry belongs to, or `""` when the name carries none. */
export function entrySessionId(name) {
  const match = ENTRY_SESSION_PATTERN.exec(typeof name === "string" ? name : "");
  return match ? match[1] : "";
}

const deny = (action, resource = "*") => ({
  action,
  resource,
  effect: "deny",
});
const allow = (action, resource = "*") => ({
  action,
  resource,
  effect: "allow",
});

/**
 * The rules that leave exactly the listed entries usable in a session.
 *
 * Deny first, allow after: the last matching rule wins, so a non-owner (no
 * entries) ends up with the deny-only set, which hides every entry of this app
 * while leaving the user's own MCP servers and OpenCode's built-in tools alone.
 *
 * OpenCode 2.3.0 exposes MCP servers as tools only; the two resource actions are
 * covered for builds that add resource tools, where the server is the resource of
 * `opencode_list_mcp_resources` and `<server>:<uri>` that of
 * `opencode_read_mcp_resource`.
 */
export function scopeRules(entryNames = []) {
  const rules = [
    deny("chatai-*"),
    deny("opencode_list_mcp_resources"),
    deny("opencode_read_mcp_resource"),
  ];
  for (const name of entryNames.filter(isChatAiMcpEntry)) {
    rules.push(allow(`${name}_*`));
    rules.push(allow("opencode_list_mcp_resources", name));
    rules.push(allow("opencode_read_mcp_resource", `${name}:*`));
  }
  return rules;
}

const parentOf = (session) => session?.parentID || session?.parentId || "";

const visits = (sessions) =>
  (Array.isArray(sessions) ? sessions : []).filter(
    (session) => typeof session?.id === "string" && session.id,
  );

const canStore = () => typeof localStorage !== "undefined";

/**
 * Whether `sessionId` is `ownerSessionId` or one of its descendants.
 *
 * A subagent session runs its own tool calls, so it needs the entries of the
 * session that spawned it; anything else must not see them.
 */
export function isSessionInTree(sessionId, ownerSessionId, sessions = []) {
  if (!sessionId || !ownerSessionId) return false;
  const parents = new Map(
    sessions.map((session) => [session?.id, parentOf(session)]),
  );
  let current = sessionId;
  for (let depth = 0; depth < 100 && current; depth += 1) {
    if (current === ownerSessionId) return true;
    current = parents.get(current) || "";
  }
  return false;
}

/**
 * What every session's ruleset should look like.
 *
 * Pure, so the scoping can be tested without OpenCode: `sessions` is the flat
 * `GET /api/session` list, `entryNames` are the entries that exist right now. The
 * owner of each entry is its own name, so no session id has to be passed in —
 * which is also why a session switch needs no separate run: the entry names move.
 * With no entry at all the answer is "no rules of ours" for everyone, which is
 * also how a removed entry is cleaned up.
 */
export function sessionScopePlan({ sessions = [], entryNames = [] }) {
  const entries = entryNames.filter(isChatAiMcpEntry);
  return visits(sessions).map((session) => {
    const owned = entries.filter((name) => {
      const owner = entrySessionId(name);
      return !!owner && isSessionInTree(session?.id, owner, sessions);
    });
    return {
      sessionId: session?.id,
      owned,
      rules: entries.length ? scopeRules(owned) : [],
    };
  });
}

const sameRule = (a, b) =>
  a?.action === b?.action &&
  a?.resource === b?.resource &&
  a?.effect === b?.effect;

const sameRules = (a = [], b = []) =>
  a.length === b.length && a.every((rule, index) => sameRule(rule, b[index]));

const storageKey = (agentId) => `${STORAGE_PREFIX}:${agentId}`;

/** The rules this app wrote for each session of one agent, as last written. */
export function loadAppliedScope(agentId) {
  if (!canStore() || !agentId) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(agentId)) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result = {};
    for (const [sessionId, rules] of Object.entries(parsed)) {
      if (Array.isArray(rules)) {
        result[sessionId] = rules.filter(
          (rule) => typeof rule?.action === "string",
        );
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function saveAppliedScope(agentId, applied) {
  if (!canStore() || !agentId) return;
  try {
    localStorage.setItem(storageKey(agentId), JSON.stringify(applied || {}));
  } catch {
    // A full quota must not break the turn; the next run falls back to writing
    // the full set again.
  }
}

/**
 * Recompute every session of the agent, and patch the ones that differ.
 *
 * The rules this app wrote last time are removed before the new ones are added,
 * so a rule the user added in the meantime survives, and the `PATCH` only runs
 * for sessions whose ruleset actually changes.
 */
export async function applyMcpSessionScope(agent, { entryNames = [] } = {}) {
  const sessions = visits(await listOpencodeSessions(agent));
  const plan = sessionScopePlan({ sessions, entryNames });
  if (!plan.length) return { updated: [], failed: [] };

  const applied = loadAppliedScope(agent?.id);
  const next = { ...applied };
  const updated = [];
  const failed = [];

  for (const { sessionId, rules } of plan) {
    const session = sessions.find((entry) => entry.id === sessionId);
    const current = Array.isArray(session?.permissions) ? session.permissions : [];
    const previous = Array.isArray(applied[sessionId]) ? applied[sessionId] : [];
    // Keep the user's rules: drop only what this app wrote before.
    const kept = current.filter(
      (rule) => !previous.some((written) => sameRule(written, rule)),
    );
    const desired = [...kept, ...rules];
    if (sameRules(desired, current)) {
      next[sessionId] = rules;
      continue;
    }
    try {
      await updateOpencodeSessionPermissions(agent, sessionId, desired);
      next[sessionId] = rules;
      updated.push(sessionId);
    } catch (reason) {
      // Keep the old record: a patch that failed wrote nothing, so the next run
      // must not think those rules are still ours to remove.
      failed.push({
        sessionId,
        error: reason instanceof Error ? reason.message : String(reason),
      });
    }
  }

  const known = new Set(plan.map((entry) => entry.sessionId));
  for (const sessionId of Object.keys(next)) {
    if (!known.has(sessionId)) delete next[sessionId];
  }
  saveAppliedScope(agent?.id, next);
  return { updated, failed };
}
