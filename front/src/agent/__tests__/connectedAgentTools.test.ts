import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAgents: vi.fn(),
  conversationWorkspaces: vi.fn(),
  agentLinks: vi.fn(),
  sessionLinks: vi.fn(),
  fetchSessions: vi.fn(),
  switchSession: vi.fn(),
  deleteSession: vi.fn(),
  messages: vi.fn(),
  info: vi.fn(),
  status: vi.fn(),
}));

vi.mock("../../agents/agentStore", () => ({
  getAgents: (...args) => mocks.getAgents(...args),
}));
vi.mock("../../db/workspaceDb", () => ({
  getConversationWorkspaceIds: (...args) => mocks.conversationWorkspaces(...args),
  getWorkspaceAgentLinks: (...args) => mocks.agentLinks(...args),
  getWorkspaceAgentSessionIds: (...args) => mocks.sessionLinks(...args),
}));
vi.mock("../../agents/agentSessions", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    fetchAgentSessions: (...args) => mocks.fetchSessions(...args),
    switchAgentSession: (...args) => mocks.switchSession(...args),
    deleteAgentSession: (...args) => mocks.deleteSession(...args),
  };
});
vi.mock("../../apis/opencodeAgents", () => ({
  listOpencodeMessages: (...args) => mocks.messages(...args),
  getOpencodeInfo: (...args) => mocks.info(...args),
  getOpencodeSessionStatus: (...args) => mocks.status(...args),
  listOpencodeFiles: vi.fn(async () => []),
  readOpencodeFile: vi.fn(),
}));

import { createConnectedAgentTools } from "../connectedAgentTools";

const session = (id: string, title: string, parentID?: string) => ({
  id,
  title,
  ...(parentID ? { parentID } : {}),
});

const treeOf = (sessions: any[]) => ({
  roots: sessions.filter((item) => !item.parentID),
  all: sessions,
  children: new Map(),
});

const agent = {
  id: "agent-1",
  name: "HPC agent",
  sessionId: "session-shared",
};

const tool = async (name: string, workspaceScoped = true) => {
  const tools = await createConnectedAgentTools(
    "chat-1",
    {} as any,
  );
  const found = tools.find((item) => item.name === name);
  if (!found) throw new Error(`missing tool ${name}`);
  return { run: (args: any) => found.execute("call", args), workspaceScoped };
};

const textOf = (result: any) => String(result?.content?.[0]?.text ?? "");

beforeEach(() => {
  mocks.getAgents.mockReset().mockReturnValue([agent]);
  mocks.conversationWorkspaces.mockReset().mockResolvedValue(["ws-1"]);
  mocks.agentLinks.mockReset().mockResolvedValue([
    { workspaceId: "ws-1", agentId: "agent-1" },
  ]);
  mocks.sessionLinks.mockReset().mockImplementation(async (workspaceId) =>
    workspaceId === "ws-1" ? ["session-shared"] : ["session-other-workspace"],
  );
  mocks.fetchSessions.mockReset().mockResolvedValue(
    treeOf([
      session("session-shared", "Shared work"),
      session("session-other-workspace", "Other workspace work"),
      session("session-unassigned", "Unrelated work"),
    ]),
  );
  mocks.messages.mockReset().mockResolvedValue([
    { id: "m1", type: "user", text: "Scoped question" },
  ]);
  mocks.info.mockResolvedValue({});
  mocks.status.mockResolvedValue({});
});

describe("connected agent tools workspace scope", () => {
  it("lists only the sessions attached to the chat's workspace", async () => {
    const sessions = await tool("connected_agent_list_sessions");
    const output = textOf(await sessions.run({ agent: "agent-1" }));

    expect(output).toContain("session-shared");
    expect(output).toContain("Shared work");
    expect(output).not.toContain("session-other-workspace");
    expect(output).not.toContain("session-unassigned");
    expect(output).toContain("Only sessions attached to this chat's workspace");
  });

  it("reads the history of an attached session but not of another one", async () => {
    const history = await tool("connected_agent_history");

    const allowed = await history.run({
      agent: "agent-1",
      session: "session-shared",
    });
    expect(mocks.messages).toHaveBeenCalledWith(agent, "session-shared");
    expect(textOf(allowed)).toContain("Scoped question");

    mocks.messages.mockClear();
    const blocked = await history.run({
      agent: "agent-1",
      session: "session-other-workspace",
    });
    expect(mocks.messages).not.toHaveBeenCalled();
    expect(textOf(blocked)).toContain("Session not found");
  });

  it("refuses to read the active session when it belongs to another workspace", async () => {
    mocks.getAgents.mockReturnValue([
      { ...agent, sessionId: "session-other-workspace" },
    ]);
    const history = await tool("connected_agent_history");

    const result = await history.run({ agent: "agent-1" });

    expect(mocks.messages).not.toHaveBeenCalled();
    expect(textOf(result)).toContain("not attached to this chat's workspace");
  });

  it("refuses to switch to a session of another workspace", async () => {
    const switchTo = await tool("connected_agent_switch_session");

    const result = await switchTo.run({
      agent: "agent-1",
      session: "session-other-workspace",
    });

    expect(mocks.switchSession).not.toHaveBeenCalled();
    expect(textOf(result)).toContain("Session not found");
    expect(textOf(result)).toContain("session-shared");
  });

  it("switches to an attached session", async () => {
    const switchTo = await tool("connected_agent_switch_session");

    const result = await switchTo.run({
      agent: "agent-1",
      session: "session-shared",
    });

    expect(mocks.switchSession).toHaveBeenCalledWith(agent, "session-shared");
    expect(textOf(result)).toContain("Switched HPC agent");
  });

  it("keeps every session for an agent bridged to the whole workspace", async () => {
    mocks.agentLinks.mockResolvedValue([]);
    mocks.getAgents.mockReturnValue([
      { ...agent, sessionId: "", bridgeWorkspaceId: "ws-1" },
    ]);
    const sessions = await tool("connected_agent_list_sessions");

    const output = textOf(await sessions.run({ agent: "agent-1" }));

    expect(output).toContain("session-other-workspace");
    expect(output).toContain("session-unassigned");
    expect(output).not.toContain("Only sessions attached");
  });

  it("offers no connected agent tools without a workspace link", async () => {
    mocks.conversationWorkspaces.mockResolvedValue([]);

    const tools = await createConnectedAgentTools("chat-1", {} as any);

    expect(tools).toHaveLength(0);
  });
});
