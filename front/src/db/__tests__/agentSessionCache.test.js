import { beforeEach, describe, expect, it } from "vitest";

import { db } from "../index";
import {
  loadAgentSessionMessages,
  loadAgentSessions,
  removeAgentSessionCache,
  removeAgentSessionCacheForAgent,
  saveAgentSessionMessages,
  saveAgentSessions,
} from "../agentSessionCache";

const userMessage = (id, text) => ({ id, type: "user", text });

beforeEach(async () => {
  await db.agent_session_messages.clear();
  await db.agent_sessions.clear();
});

describe("agent session cache", () => {
  it("stores a complete history and restores it in order", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [userMessage("m1", "Hello"), userMessage("m2", "World")],
      { replace: true },
    );

    const cached = await loadAgentSessionMessages("agent-1", "session-1");
    expect(cached.messages.map((message) => message.id)).toEqual(["m1", "m2"]);
    expect(cached.lastMessageId).toBe("m2");
    expect(cached.syncedAt).toBeGreaterThan(0);
  });

  it("updates only the changed tail of a session", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [userMessage("m1", "Hello"), userMessage("m2", "Wor")],
      { replace: true },
    );

    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [userMessage("m2", "World"), userMessage("m3", "Again")],
      { startIndex: 1 },
    );

    const cached = await loadAgentSessionMessages("agent-1", "session-1");
    expect(cached.messages.map((message) => message.id)).toEqual([
      "m1",
      "m2",
      "m3",
    ]);
    expect(cached.messages[1].text).toBe("World");
    expect(cached.lastMessageId).toBe("m3");
    expect(
      await db.agent_session_messages
        .where("[agentId+sessionId]")
        .equals(["agent-1", "session-1"])
        .count(),
    ).toBe(3);
  });

  it("keeps sessions of different agents and workspaces apart", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [userMessage("m1", "One")],
      { replace: true },
    );
    await saveAgentSessionMessages(
      "agent-2",
      "session-1",
      [userMessage("m1", "Two")],
      { replace: true },
    );

    expect(
      (await loadAgentSessionMessages("agent-1", "session-1")).messages[0].text,
    ).toBe("One");
    expect(
      (await loadAgentSessionMessages("agent-2", "session-1")).messages[0].text,
    ).toBe("Two");
  });

  it("clears the history when the server reports an empty session", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [userMessage("m1", "Hello")],
      { replace: true },
    );
    await saveAgentSessionMessages("agent-1", "session-1", [], {
      replace: true,
    });

    const cached = await loadAgentSessionMessages("agent-1", "session-1");
    expect(cached.messages).toEqual([]);
    expect(cached.lastMessageId).toBeNull();
  });

  it("caches session metadata for the offline list", async () => {
    await saveAgentSessions("agent-1", [
      { id: "session-1", title: "First" },
      { id: "session-2", title: "Second" },
    ]);
    expect(
      (await loadAgentSessions("agent-1")).map((session) => session.title),
    ).toEqual(["First", "Second"]);

    await saveAgentSessions("agent-1", [
      { id: "session-1", title: "Renamed" },
    ]);
    expect(
      (await loadAgentSessions("agent-1"))
        .map((session) => session.title)
        .sort(),
    ).toEqual(["Renamed", "Second"]);
  });

  it("removes one session or every session of an agent", async () => {
    await saveAgentSessionMessages(
      "agent-1",
      "session-1",
      [userMessage("m1", "Hello")],
      { replace: true },
    );
    await saveAgentSessionMessages(
      "agent-1",
      "session-2",
      [userMessage("m2", "Hello")],
      { replace: true },
    );
    await saveAgentSessions("agent-1", [
      { id: "session-1", title: "First" },
      { id: "session-2", title: "Second" },
    ]);

    await removeAgentSessionCache("agent-1", "session-1");
    expect(
      (await loadAgentSessionMessages("agent-1", "session-1")).messages,
    ).toEqual([]);
    expect(
      (await loadAgentSessionMessages("agent-1", "session-2")).messages,
    ).toHaveLength(1);

    await removeAgentSessionCacheForAgent("agent-1");
    expect(await loadAgentSessions("agent-1")).toEqual([]);
    expect(await db.agent_session_messages.count()).toBe(0);
  });
});
