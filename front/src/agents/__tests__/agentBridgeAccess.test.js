import { describe, expect, it } from "vitest";

import { addAgent, getAgent } from "../agentStore";
import {
  attachedWorkspaces,
  disableAgentBridgeAfterFailure,
  isAgentBridgeEnabled,
  resolveBridgeWorkspace,
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

  it("only flips the switch and never invents a workspace", () => {
    // An access flag without an attachment would otherwise expose the account's first
    // workspace to an agent the user never connected it to.
    addAgent({ id: "bridge-agent-1", name: "One", sessionId: "s1" });

    setAgentBridgeEnabled(getAgent("bridge-agent-1"), true);

    expect(getAgent("bridge-agent-1")).toMatchObject({ bridgeEnabled: true });
    expect(getAgent("bridge-agent-1").bridgeWorkspaceId).toBeUndefined();
  });

  it("keeps the chosen workspace when access is switched off", () => {
    addAgent({
      id: "bridge-agent-2",
      name: "Two",
      sessionId: "s1",
      bridgeEnabled: true,
      bridgeWorkspaceId: "ws-2",
    });

    setAgentBridgeEnabled(getAgent("bridge-agent-2"), false);

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
      disableAgentBridgeAfterFailure(getAgent("bridge-agent-3")),
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
      disableAgentBridgeAfterFailure(getAgent("bridge-agent-4")),
    ).toBe(false);
    expect(getAgent("bridge-agent-4")).toEqual(before);
  });

  it("lists only the workspaces the agent is attached to", () => {
    const links = [{ workspaceId: "ws-2" }];

    expect(attachedWorkspaces(workspaces, links)).toEqual([workspaces[1]]);
    expect(attachedWorkspaces(workspaces, [])).toEqual([]);
    expect(attachedWorkspaces([], links)).toEqual([]);
  });

  it("never exposes a workspace that is not attached", () => {
    // A remembered choice alone (or another workspace of the account) is not an attachment.
    expect(resolveBridgeWorkspace({ bridgeWorkspaceId: "ws-2" }, [])).toBeNull();
    expect(
      resolveBridgeWorkspace({ bridgeWorkspaceId: "ws-2" }, [workspaces[0]]),
    ).toEqual(workspaces[0]);
    expect(resolveBridgeWorkspace({}, [workspaces[0], workspaces[1]])).toEqual(
      workspaces[0],
    );
  });
});
