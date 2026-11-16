import { describe, expect, it } from "vitest";

import { addAgent, getAgent } from "../agentStore";
import {
  disableAgentBridgeAfterFailure,
  isAgentBridgeEnabled,
  setAgentBridgeEnabled,
} from "../agentBridgeAccess";

const workspaces = [
  { id: "ws-1", name: "Example project" },
  { id: "ws-2", name: "Second project" },
];

describe("agent bridge access", () => {
  it("keeps access on for agents that already had a bridge workspace", () => {
    expect(isAgentBridgeEnabled({ id: "agent-1" })).toBe(false);
    expect(
      isAgentBridgeEnabled({ id: "agent-1", bridgeWorkspaceId: "ws-1" }),
    ).toBe(true);
    expect(
      isAgentBridgeEnabled({
        id: "agent-1",
        bridgeWorkspaceId: "ws-1",
        bridgeEnabled: false,
      }),
    ).toBe(false);
  });

  it("picks a workspace when access is switched on", () => {
    addAgent({ id: "bridge-agent-1", name: "One", sessionId: "s1" });

    setAgentBridgeEnabled(getAgent("bridge-agent-1"), true, workspaces);

    expect(getAgent("bridge-agent-1")).toMatchObject({
      bridgeEnabled: true,
      bridgeWorkspaceId: "ws-1",
    });
  });

  it("keeps the chosen workspace when access is switched off", () => {
    addAgent({
      id: "bridge-agent-2",
      name: "Two",
      sessionId: "s1",
      bridgeEnabled: true,
      bridgeWorkspaceId: "ws-2",
    });

    setAgentBridgeEnabled(getAgent("bridge-agent-2"), false, workspaces);

    expect(getAgent("bridge-agent-2")).toMatchObject({
      bridgeEnabled: false,
      bridgeWorkspaceId: "ws-2",
    });
  });

  it("switches access off after a bridge failure and keeps the workspace", () => {
    addAgent({
      id: "bridge-agent-3",
      name: "Three",
      sessionId: "s1",
      bridgeEnabled: true,
      bridgeWorkspaceId: "ws-2",
    });

    expect(
      disableAgentBridgeAfterFailure(getAgent("bridge-agent-3"), workspaces),
    ).toBe(true);

    expect(getAgent("bridge-agent-3")).toMatchObject({
      bridgeEnabled: false,
      bridgeWorkspaceId: "ws-2",
    });
  });

  it("does nothing after a failure while access is already off", () => {
    addAgent({
      id: "bridge-agent-4",
      name: "Four",
      sessionId: "s1",
      bridgeEnabled: false,
      bridgeWorkspaceId: "ws-1",
    });
    const before = getAgent("bridge-agent-4");

    expect(
      disableAgentBridgeAfterFailure(getAgent("bridge-agent-4"), workspaces),
    ).toBe(false);
    expect(getAgent("bridge-agent-4")).toEqual(before);
  });
});
