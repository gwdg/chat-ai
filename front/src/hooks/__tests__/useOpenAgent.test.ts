import { describe, expect, it } from "vitest";
import { activeSessionIdFor, parseOpenAgent } from "../useOpenAgent";

const agent = { id: "agent-1", sessionId: "session-1" };

describe("parseOpenAgent", () => {
  it("reads the agent and session of an agent route", () => {
    expect(parseOpenAgent("/agent/agent-1", "?session=session-2")).toEqual({
      agentId: "agent-1",
      sessionId: "session-2",
    });
  });

  it("returns no agent for a chat or workspace route", () => {
    expect(parseOpenAgent("/chat/chat-1", "")).toEqual({
      agentId: null,
      sessionId: null,
    });
    expect(parseOpenAgent("/workspace/ws-1", "")).toEqual({
      agentId: null,
      sessionId: null,
    });
  });

  it("decodes an escaped agent id", () => {
    expect(parseOpenAgent("/agent/agent%201", "").agentId).toBe("agent 1");
  });
});

describe("activeSessionIdFor", () => {
  it("uses the route session of the open agent", () => {
    expect(
      activeSessionIdFor(
        { agentId: "agent-1", sessionId: "session-2" },
        agent,
      ),
    ).toBe("session-2");
  });

  it("falls back to the agent's active session when the route names none", () => {
    expect(
      activeSessionIdFor({ agentId: "agent-1", sessionId: null }, agent),
    ).toBe("session-1");
  });

  it("marks nothing when another page is open", () => {
    expect(
      activeSessionIdFor({ agentId: null, sessionId: null }, agent),
    ).toBeNull();
    expect(
      activeSessionIdFor({ agentId: "agent-2", sessionId: "session-9" }, agent),
    ).toBeNull();
  });
});
