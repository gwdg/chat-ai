import { describe, expect, it } from "vitest";

import { buildSessionTree } from "../agentSessions";
import {
  agentWorkspaceIds,
  agentWorkspaceSessionIds,
  filterSessionTree,
  unassignedSessionIds,
  workspaceSessionIds,
} from "../workspaceAgentSessions";

const sessions = [
  { id: "root-a", title: "Root A", time: { updated: 50 } },
  { id: "root-b", title: "Root B", time: { updated: 40 } },
  { id: "child-a", title: "Child A", parentID: "root-a", time: { updated: 30 } },
  { id: "child-b", title: "Child B", parentID: "root-b", time: { updated: 20 } },
];

const tree = buildSessionTree(sessions);

const link = (workspaceId, agentId, sessionId) => ({
  id: `${workspaceId}:${agentId}:${sessionId}`,
  workspaceId,
  agentId,
  sessionId,
  createdAt: 1,
});

const links = [
  link("ws-1", "agent-1", "root-a"),
  link("ws-1", "agent-1", "child-b"),
  link("ws-2", "agent-1", "root-b"),
  link("ws-2", "agent-2", "root-a"),
];

const ids = (set) => [...set].sort();

describe("workspace agent sessions", () => {
  it("collects the sessions of one workspace and agent", () => {
    expect(ids(workspaceSessionIds(links, "ws-1", "agent-1"))).toEqual([
      "child-b",
      "root-a",
    ]);
    expect(ids(workspaceSessionIds(links, "ws-1", "agent-2"))).toEqual([]);
  });

  it("collects every workspace a session of the agent is attached to", () => {
    expect(ids(agentWorkspaceSessionIds(links, "agent-1"))).toEqual([
      "child-b",
      "root-a",
      "root-b",
    ]);
    expect(agentWorkspaceIds(links, "agent-1")).toEqual(["ws-1", "ws-2"]);
    expect(agentWorkspaceIds(links, "missing")).toEqual([]);
  });

  it("filters a session tree and keeps subtrees and parents", () => {
    const withRoot = filterSessionTree(tree, new Set(["root-a"]));
    expect(
      withRoot.all.map((session) => session.id).sort(),
    ).toEqual(["child-a", "root-a"]);
    expect(withRoot.roots.map((session) => session.id)).toEqual(["root-a"]);

    const withChild = filterSessionTree(tree, new Set(["child-b"]));
    expect(withChild.all.map((session) => session.id).sort()).toEqual([
      "child-b",
      "root-b",
    ]);
    expect(withChild.roots.map((session) => session.id)).toEqual(["root-b"]);
  });

  it("keeps the offline marker of the unfiltered tree", () => {
    const offline = { ...tree, offline: true };
    expect(filterSessionTree(offline, new Set(["root-a"])).offline).toBe(true);
    expect(filterSessionTree(tree, new Set(["root-a"])).offline).toBe(
      undefined,
    );
  });

  it("keeps the whole tree when no filter is given", () => {
    expect(filterSessionTree(tree, null)).toBe(tree);
  });

  it("reports sessions that no workspace shows", () => {
    expect(ids(unassignedSessionIds(tree, [], "agent-1"))).toEqual([
      "child-a",
      "child-b",
      "root-a",
      "root-b",
    ]);

    // root-a brings child-a with it; child-b and root-b stay unattached.
    expect(
      ids(
        unassignedSessionIds(
          tree,
          [link("ws-1", "agent-1", "root-a")],
          "agent-1",
        ),
      ),
    ).toEqual(["child-b", "root-b"]);

    // Every session of agent-1 is part of a workspace now.
    expect(ids(unassignedSessionIds(tree, links, "agent-1"))).toEqual([]);
    // Links of another agent do not hide them.
    expect(ids(unassignedSessionIds(tree, links, "agent-2"))).not.toContain(
      "root-a",
    );
  });
});
