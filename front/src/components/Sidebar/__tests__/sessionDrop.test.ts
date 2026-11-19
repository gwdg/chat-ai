import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachAgent: vi.fn(async () => {}),
  attachSession: vi.fn(async () => {}),
  detachSession: vi.fn(async () => {}),
}));

vi.mock("../../../db/workspaceDb", () => ({
  attachWorkspaceAgent: mocks.attachAgent,
  attachWorkspaceAgentSession: mocks.attachSession,
  detachWorkspaceAgentSession: mocks.detachSession,
}));

import {
  AGENT_SESSION_DRAG_MIME,
  AGENT_SESSION_SOURCE_WORKSPACE_MIME,
  dropAgentSessionOnWorkspace,
  isAgentSessionDrag,
  readAgentSessionDrag,
  setAgentSessionDragData,
} from "../sessionDrop";

// jsdom has no working DataTransfer, so the helpers get a small stand-in with
// the three members they use.
const makeDataTransfer = (entries: Record<string, string> = {}) => {
  const data = new Map(Object.entries(entries));
  return {
    typeList: data,
    get types() {
      return [...data.keys()];
    },
    getData: (type: string) => data.get(type) ?? "",
    setData: (type: string, value: string) => {
      data.set(type, value);
    },
    effectAllowed: "none",
    dropEffect: "none",
  } as unknown as DataTransfer;
};

beforeEach(() => {
  mocks.attachAgent.mockClear();
  mocks.attachSession.mockClear();
  mocks.detachSession.mockClear();
});

describe("agent session drag data", () => {
  it("writes the agent, session and source workspace", () => {
    const dataTransfer = makeDataTransfer();

    setAgentSessionDragData(dataTransfer, "agent-1", "session-1", "ws-1");

    expect(isAgentSessionDrag(dataTransfer)).toBe(true);
    expect(dataTransfer.getData("text/plain")).toBe("session-1");
    expect(
      JSON.parse(dataTransfer.getData(AGENT_SESSION_DRAG_MIME)),
    ).toEqual({ agentId: "agent-1", sessionId: "session-1" });
    expect(dataTransfer.getData(AGENT_SESSION_SOURCE_WORKSPACE_MIME)).toBe(
      "ws-1",
    );
    expect(readAgentSessionDrag(dataTransfer)).toEqual({
      agentId: "agent-1",
      sessionId: "session-1",
      workspaceId: "ws-1",
    });
    expect(dataTransfer.effectAllowed).toBe("move");
  });

  it("omits the source workspace for an unassigned session", () => {
    const dataTransfer = makeDataTransfer();

    setAgentSessionDragData(dataTransfer, "agent-1", "session-1");

    expect(dataTransfer.getData(AGENT_SESSION_SOURCE_WORKSPACE_MIME)).toBe("");
    expect(readAgentSessionDrag(dataTransfer)).toEqual({
      agentId: "agent-1",
      sessionId: "session-1",
      workspaceId: null,
    });
  });

  it("ignores other drags and malformed payloads", () => {
    expect(isAgentSessionDrag(makeDataTransfer({ Files: "" }))).toBe(false);
    expect(
      isAgentSessionDrag(makeDataTransfer({ "application/x-chatai-chat": "chat-1" })),
    ).toBe(false);
    expect(
      readAgentSessionDrag(makeDataTransfer({ [AGENT_SESSION_DRAG_MIME]: "{" })),
    ).toBeNull();
    expect(
      readAgentSessionDrag(
        makeDataTransfer({ [AGENT_SESSION_DRAG_MIME]: JSON.stringify({}) }),
      ),
    ).toBeNull();
  });
});

describe("dropping a session on a workspace", () => {
  it("links the agent and session to a workspace the agent is not in yet", async () => {
    await dropAgentSessionOnWorkspace({
      agentId: "agent-1",
      sessionId: "session-1",
      targetWorkspaceId: "ws-2",
    });

    expect(mocks.detachSession).not.toHaveBeenCalled();
    expect(mocks.attachAgent).toHaveBeenCalledWith("ws-2", "agent-1");
    expect(mocks.attachSession).toHaveBeenCalledWith(
      "ws-2",
      "agent-1",
      "session-1",
    );
  });

  it("moves a session out of the workspace it came from", async () => {
    await dropAgentSessionOnWorkspace({
      agentId: "agent-1",
      sessionId: "session-1",
      targetWorkspaceId: "ws-2",
      sourceWorkspaceId: "ws-1",
    });

    expect(mocks.detachSession).toHaveBeenCalledWith(
      "ws-1",
      "agent-1",
      "session-1",
    );
    expect(mocks.attachSession).toHaveBeenCalledWith(
      "ws-2",
      "agent-1",
      "session-1",
    );
    // The link is removed before it is added at the destination.
    expect(mocks.detachSession.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.attachSession.mock.invocationCallOrder[0],
    );
  });

  it("does not detach when the session is dropped on its own workspace", async () => {
    await dropAgentSessionOnWorkspace({
      agentId: "agent-1",
      sessionId: "session-1",
      targetWorkspaceId: "ws-1",
      sourceWorkspaceId: "ws-1",
    });

    expect(mocks.detachSession).not.toHaveBeenCalled();
    expect(mocks.attachSession).toHaveBeenCalledWith(
      "ws-1",
      "agent-1",
      "session-1",
    );
  });

  it("does nothing for an incomplete drop", async () => {
    await dropAgentSessionOnWorkspace({
      agentId: "agent-1",
      sessionId: "",
      targetWorkspaceId: "ws-2",
    });

    expect(mocks.attachAgent).not.toHaveBeenCalled();
    expect(mocks.attachSession).not.toHaveBeenCalled();
    expect(mocks.detachSession).not.toHaveBeenCalled();
  });
});
