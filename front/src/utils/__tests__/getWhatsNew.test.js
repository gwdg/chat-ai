import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  agents: [],
  trees: {},
  metas: [],
  folders: [],
  info: vi.fn(async () => ({})),
  status: vi.fn(async () => ({})),
  files: vi.fn(async () => []),
}));

vi.mock("../../db", () => ({
  listConversationMetas: vi.fn(async () => state.metas),
  listFolders: vi.fn(async () => state.folders),
  searchMessages: vi.fn(async () => []),
  getRecentMessageExcerpts: vi.fn(async () => []),
  getConversationMeta: vi.fn(),
}));
vi.mock("../../db/workspaceDb", () => ({
  listWorkspaceSummaries: vi.fn(async () => []),
}));
vi.mock("../../agents/agentStore", () => ({
  getAgents: () => state.agents,
}));
vi.mock("../../agents/agentSessions", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchAgentSessions: vi.fn(async (agent) => {
      const tree = state.trees[agent.id];
      if (!tree) throw new Error("unreachable");
      return tree;
    }),
  };
});
vi.mock("../../apis/opencodeAgents", () => ({
  getOpencodeInfo: (...args) => state.info(...args),
  getOpencodeSessionStatus: (...args) => state.status(...args),
  listOpencodeMessages: vi.fn(async () => []),
  listOpencodeFiles: (...args) => state.files(...args),
  readOpencodeFile: vi.fn(),
  runOpencodeShellAndWait: vi.fn(async () => {
    throw new Error("no shell");
  }),
}));

import { getWhatsNew } from "../metaTools";

const now = Date.now();
const since = () => new Date(now - 60 * 1000).toISOString();

const session = (id, title, parentID) => ({
  id,
  title,
  ...(parentID ? { parentID } : {}),
  time: { updated: now },
});

const treeOf = (sessions) => ({
  roots: sessions.filter((item) => !item.parentID),
  all: sessions,
  children: new Map(),
});

beforeEach(() => {
  state.agents = [
    { id: "agent-1", name: "Teaching agent", sessionId: "session-1" },
    { id: "agent-2", name: "Other agent", sessionId: "session-2" },
  ];
  state.trees = {
    "agent-1": treeOf([
      session("session-1", "Attached session"),
      session("sub-1", "Attached subagent", "session-1"),
      session("session-1b", "Unattached session"),
    ]),
    "agent-2": treeOf([session("session-2", "Other workspace session")]),
  };
  state.metas = [
    { id: "chat-1", title: "Workspace chat", lastModified: now },
    { id: "chat-2", title: "Unrelated chat", lastModified: now },
  ];
  state.folders = [];
  state.info.mockReset().mockResolvedValue({});
  state.status.mockReset().mockResolvedValue({});
  state.files.mockReset().mockResolvedValue([]);
});

describe("getWhatsNew workspace scope", () => {
  it("reports on every chat and agent without a scope", async () => {
    const text = await getWhatsNew({ since: since() });

    expect(text).toContain("Workspace chat");
    expect(text).toContain("Unrelated chat");
    expect(text).toContain("Attached session");
    expect(text).toContain("Unattached session");
    expect(text).toContain("Other workspace session");
    expect(text).toContain("Other agent");
  });

  it("only reports the chats, agents and sessions in the scope", async () => {
    const text = await getWhatsNew({
      since: since(),
      scope: {
        agentIds: ["agent-1"],
        sessionIds: { "agent-1": ["session-1"] },
        conversationIds: ["chat-1"],
      },
    });

    expect(text).toContain("Workspace chat");
    expect(text).not.toContain("Unrelated chat");
    expect(text).toContain("Attached session");
    // Subagents stay with their attached parent session.
    expect(text).toContain("Attached subagent");
    expect(text).not.toContain("Unattached session");
    expect(text).not.toContain("Other workspace session");
    expect(text).not.toContain("Other agent");
  });

  it("does not name an active session outside the scope", async () => {
    state.agents = [
      { id: "agent-1", name: "Teaching agent", sessionId: "session-1b" },
    ];
    const text = await getWhatsNew({
      since: since(),
      scope: {
        agentIds: ["agent-1"],
        sessionIds: { "agent-1": ["session-1"] },
        conversationIds: ["chat-1"],
      },
    });

    expect(text).toContain("not in this scope");
    expect(text).not.toContain("session-1b");
  });

  it("keeps every session of an agent without a session scope", async () => {
    const text = await getWhatsNew({
      since: since(),
      scope: {
        agentIds: ["agent-2"],
        sessionIds: {},
        conversationIds: [],
      },
    });

    expect(text).toContain("Other workspace session");
    expect(text).not.toContain("Workspace chat");
  });
});
