import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  list: vi.fn(async () => []),
  patch: vi.fn(async () => null),
}));

vi.mock("../../apis/opencodeAgents", () => ({
  listOpencodeSessions: (...args) => mocks.list(...args),
  updateOpencodeSessionPermissions: (...args) => mocks.patch(...args),
}));

import {
  applyMcpSessionScope,
  entrySessionId,
  isSessionInTree,
  loadAppliedScope,
  saveAppliedScope,
  scopeRules,
  sessionScopePlan,
} from "../agentMcpScope";

const agent = { id: "agent-1" };

const OLD = "ses_old";
const NEW = "ses_new";
const CHILD = "ses_child";
const STRANGER = "ses_stranger";

const DENY_CHATAI = { action: "chatai-*", resource: "*", effect: "deny" };
const DENY_LIST = {
  action: "opencode_list_mcp_resources",
  resource: "*",
  effect: "deny",
};
const DENY_READ = {
  action: "opencode_read_mcp_resource",
  resource: "*",
  effect: "deny",
};

beforeEach(() => {
  localStorage.clear();
  mocks.list.mockReset();
  mocks.list.mockResolvedValue([]);
  mocks.patch.mockReset();
  mocks.patch.mockResolvedValue(null);
});

describe("agent MCP session scope", () => {
  it("reads the owning session out of an entry name", () => {
    expect(entrySessionId(`chatai-ext-web-search-${NEW}`)).toBe(NEW);
    expect(entrySessionId(`chatai-bridge-${NEW}`)).toBe(NEW);
    expect(entrySessionId("chatai-ext-web-search")).toBe("");
    expect(entrySessionId("manual")).toBe("");
    expect(entrySessionId(undefined)).toBe("");
  });

  it("follows the parent chain, so a subagent keeps its parent's entries", () => {
    const sessions = [
      { id: OLD },
      { id: NEW },
      { id: CHILD, parentID: NEW },
      { id: STRANGER },
    ];

    expect(isSessionInTree(NEW, NEW, sessions)).toBe(true);
    expect(isSessionInTree(CHILD, NEW, sessions)).toBe(true);
    expect(isSessionInTree(OLD, NEW, sessions)).toBe(false);
    expect(isSessionInTree(STRANGER, NEW, sessions)).toBe(false);
  });

  it("denies every chatai entry first and allows the owned ones after it", () => {
    // OpenCode applies the last matching rule, so the allow has to come second or the deny
    // would also hide the entry the session owns.
    const rules = scopeRules([`chatai-ext-web-${NEW}`]);

    expect(rules.slice(0, 3)).toEqual([DENY_CHATAI, DENY_LIST, DENY_READ]);
    expect(rules.slice(3)).toEqual([
      {
        action: `chatai-ext-web-${NEW}_*`,
        resource: "*",
        effect: "allow",
      },
      {
        action: "opencode_list_mcp_resources",
        resource: `chatai-ext-web-${NEW}`,
        effect: "allow",
      },
      {
        action: "opencode_read_mcp_resource",
        resource: `chatai-ext-web-${NEW}:*`,
        effect: "allow",
      },
    ]);
  });

  it("gives the owner its entries and every other session the deny-only set", () => {
    const sessions = [
      { id: OLD },
      { id: NEW },
      { id: CHILD, parentID: NEW },
    ];
    const plan = sessionScopePlan({
      sessions,
      entryNames: [`chatai-ext-web-${NEW}`, `chatai-bridge-${NEW}`],
    });

    const byId = Object.fromEntries(plan.map((entry) => [entry.sessionId, entry]));
    expect(byId[NEW].owned).toEqual([
      `chatai-ext-web-${NEW}`,
      `chatai-bridge-${NEW}`,
    ]);
    expect(byId[CHILD].owned).toEqual(byId[NEW].owned);
    expect(byId[NEW].rules).toContainEqual(
      expect.objectContaining({
        action: `chatai-bridge-${NEW}_*`,
        effect: "allow",
      }),
    );
    expect(byId[OLD].owned).toEqual([]);
    expect(byId[OLD].rules).toEqual([DENY_CHATAI, DENY_LIST, DENY_READ]);
  });

  it("clears our rules when no entry is left", () => {
    const plan = sessionScopePlan({
      sessions: [{ id: NEW }],
      entryNames: [],
    });

    expect(plan[0].rules).toEqual([]);
  });

  it("patches only the sessions whose ruleset changes, keeping the user's own rules", async () => {
    const userRule = { action: "shell", resource: "git status", effect: "allow" };
    mocks.list.mockResolvedValue([
      { id: OLD, permissions: [userRule] },
      { id: NEW, permissions: [] },
    ]);

    const result = await applyMcpSessionScope(agent, {
      entryNames: [`chatai-ext-web-${NEW}`],
    });

    expect(result.failed).toEqual([]);
    expect(mocks.patch).toHaveBeenCalledTimes(2);
    const ownerPatch = mocks.patch.mock.calls.find(([, id]) => id === NEW);
    expect(ownerPatch[2]).toContainEqual(
      expect.objectContaining({
        action: `chatai-ext-web-${NEW}_*`,
        effect: "allow",
      }),
    );
    const oldPatch = mocks.patch.mock.calls.find(([, id]) => id === OLD);
    expect(oldPatch[2]).toEqual([userRule, DENY_CHATAI, DENY_LIST, DENY_READ]);
    // The rules we wrote are remembered, so a later run removes them instead of the user's.
    expect(loadAppliedScope(agent.id)[OLD]).toEqual([
      DENY_CHATAI,
      DENY_LIST,
      DENY_READ,
    ]);
  });

  it("removes its own rules again without touching what the user added", async () => {
    const userRule = { action: "shell", resource: "*", effect: "ask" };
    mocks.list.mockResolvedValue([
      { id: NEW, permissions: [userRule, DENY_CHATAI, DENY_LIST, DENY_READ] },
    ]);
    saveAppliedScope(agent.id, { [NEW]: [DENY_CHATAI, DENY_LIST, DENY_READ] });

    // No entries: injection and bridge are both off, so nothing of ours is left to hide.
    await applyMcpSessionScope(agent, { entryNames: [] });

    expect(mocks.patch).toHaveBeenCalledWith(agent, NEW, [userRule]);
    expect(loadAppliedScope(agent.id)).toEqual({ [NEW]: [] });
  });

  it("skips the request when the ruleset already matches", async () => {
    const rules = scopeRules([`chatai-bridge-${NEW}`]);
    mocks.list.mockResolvedValue([{ id: NEW, permissions: rules }]);
    // What this app wrote last time, so it is recognised as its own and not duplicated.
    saveAppliedScope(agent.id, { [NEW]: rules });

    const result = await applyMcpSessionScope(agent, {
      entryNames: [`chatai-bridge-${NEW}`],
    });

    expect(result.updated).toEqual([]);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("reports a session it could not patch and keeps its old record", async () => {
    mocks.list.mockResolvedValue([{ id: NEW }]);
    mocks.patch.mockRejectedValueOnce(new Error("Session not found"));

    const result = await applyMcpSessionScope(agent, {
      entryNames: [`chatai-bridge-${NEW}`],
    });

    expect(result.updated).toEqual([]);
    expect(result.failed).toEqual([
      { sessionId: NEW, error: "Session not found" },
    ]);
    expect(loadAppliedScope(agent.id)[NEW]).toBeUndefined();
  });

  it("forgets sessions that no longer exist", async () => {
    saveAppliedScope(agent.id, {
      [OLD]: [DENY_CHATAI, DENY_LIST, DENY_READ],
      [NEW]: [],
    });
    mocks.list.mockResolvedValue([{ id: NEW }]);

    await applyMcpSessionScope(agent, { entryNames: [`chatai-bridge-${NEW}`] });

    expect(Object.keys(loadAppliedScope(agent.id))).toEqual([NEW]);
  });
});
