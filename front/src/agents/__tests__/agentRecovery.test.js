import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  inspectAgentRecovery,
  restoreCachedSessions,
} from "../agentRecovery";
import { db } from "../../db";
import {
  loadAgentSessionMessages,
  loadAgentSessions,
  saveAgentSessionMessages,
  saveAgentSessions,
} from "../../db/agentSessionCache";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  writeInstruction: vi.fn(),
  deleteSession: vi.fn(),
  updateAgent: vi.fn(),
  getAgent: vi.fn(),
  switchSession: vi.fn(),
  notifySessions: vi.fn(),
  renameLink: vi.fn(),
}));

vi.mock("../../apis/opencodeAgents", () => ({
  createOpencodeSession: (...args) => mocks.create(...args),
  deleteOpencodeSession: (...args) => mocks.deleteSession(...args),
  listOpencodeSessions: (...args) => mocks.list(...args),
  putOpencodeInstructionEntry: (...args) => mocks.writeInstruction(...args),
}));
vi.mock("../agentStore", () => ({
  getAgent: (...args) => mocks.getAgent(...args),
  updateAgent: (...args) => mocks.updateAgent(...args),
}));
vi.mock("../agentSessions", () => ({
  notifyAgentSessionsChanged: (...args) => mocks.notifySessions(...args),
  switchAgentSession: (...args) => mocks.switchSession(...args),
}));
vi.mock("../../db/workspaceDb", () => ({
  renameWorkspaceAgentSession: (...args) => mocks.renameLink(...args),
}));

const agent = {
  id: "agent-1",
  name: "HPC agent",
  serverUrl: "http://127.0.0.1:9000",
  sessionId: "session-1",
};

const cachedMessages = [
  { id: "m1", type: "user", text: "Plan the run" },
  {
    id: "m2",
    type: "assistant",
    content: [{ type: "text", text: "Inspecting the repository." }],
  },
];

beforeEach(async () => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  await db.agent_sessions.clear();
  await db.agent_session_messages.clear();
  mocks.getAgent.mockReturnValue({ ...agent, sessionSummaries: {} });
  mocks.deleteSession.mockResolvedValue(null);
  mocks.create.mockImplementation(async (_agent, title) => ({
    id: `restored-${mocks.create.mock.calls.length}`,
    title,
  }));
});

const seedCache = async () => {
  await saveAgentSessions("agent-1", [
    { id: "session-1", title: "Design session" },
    { id: "session-2", title: "Second session" },
  ]);
  await saveAgentSessionMessages("agent-1", "session-1", cachedMessages, {
    replace: true,
    syncedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
  });
};

describe("inspectAgentRecovery", () => {
  it("reports cached sessions the reachable server no longer has", async () => {
    await seedCache();
    mocks.list.mockResolvedValue([{ id: "session-2" }]);

    const diagnosis = await inspectAgentRecovery(agent);

    expect(diagnosis.reachable).toBe(true);
    expect(diagnosis.missing.map((item) => item.session.id)).toEqual([
      "session-1",
    ]);
    expect(diagnosis.missing[0].messageCount).toBe(2);
    expect(diagnosis.currentMissing).toBe(true);
  });

  it("does not report an offline server as missing sessions", async () => {
    await seedCache();
    mocks.list.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const diagnosis = await inspectAgentRecovery(agent);

    expect(diagnosis.reachable).toBe(false);
    expect(diagnosis.missing).toEqual([]);
  });

  it("ignores cached sessions without a transcript", async () => {
    await seedCache();
    await saveAgentSessionMessages("agent-1", "session-3", [], {
      replace: true,
    });
    await saveAgentSessions("agent-1", [{ id: "session-3" }]);
    mocks.list.mockResolvedValue([]);

    const diagnosis = await inspectAgentRecovery(agent);

    expect(diagnosis.missing.map((item) => item.session.id)).toEqual([
      "session-1",
    ]);
  });
});

describe("restoreCachedSessions", () => {
  it("creates a session per cached history and keeps the transcript locally", async () => {
    await seedCache();
    mocks.list.mockResolvedValue([]);
    const diagnosis = await inspectAgentRecovery(agent);

    const restored = await restoreCachedSessions(agent, diagnosis.missing);

    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      from: "session-1",
      to: "restored-1",
      title: "Design session",
    });
    expect(mocks.create).toHaveBeenCalledWith(agent, "Design session");
    expect(mocks.writeInstruction).toHaveBeenCalledWith(
      agent,
      "restored-1",
      "chat-ai-restored-history",
      expect.stringContaining("Plan the run"),
    );
    expect(mocks.renameLink).toHaveBeenCalledWith(
      "agent-1",
      "session-1",
      "restored-1",
    );
    expect(mocks.switchSession).toHaveBeenCalledWith(agent, "restored-1");

    const cached = await loadAgentSessionMessages("agent-1", "restored-1");
    expect(cached.messages.map((item) => item.id)).toEqual(["m1", "m2"]);
    expect(cached.restoredFrom).toBe("session-1");
    const sessions = await loadAgentSessions("agent-1");
    expect(sessions.map((session) => session.id)).toContain("restored-1");
    // The old cache entry is gone, so the same session is not offered again.
    expect(sessions.map((session) => session.id)).not.toContain("session-1");
  });

  it("keeps a valid active session when another session is restored", async () => {
    await seedCache();
    const result = await restoreCachedSessions(
      { ...agent, sessionId: "session-2" },
      [{ session: { id: "session-1", title: "Design session" } }],
    );

    expect(result).toHaveLength(1);
    expect(mocks.switchSession).not.toHaveBeenCalled();
    expect(mocks.updateAgent).toHaveBeenCalled();
  });

  it("removes the created session when writing the transcript fails", async () => {
    await seedCache();
    mocks.writeInstruction.mockRejectedValue(new Error("denied"));

    await expect(
      restoreCachedSessions(agent, [
        { session: { id: "session-1", title: "Design session" } },
      ]),
    ).rejects.toThrow(/denied/);
    expect(mocks.deleteSession).toHaveBeenCalledWith(agent, "restored-1");
    expect(mocks.switchSession).not.toHaveBeenCalled();
  });
});
