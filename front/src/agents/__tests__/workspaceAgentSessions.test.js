import { beforeEach, describe, expect, it } from "vitest";

import { db } from "../../db";
import {
  attachWorkspaceAgent,
  createWorkspace,
} from "../../db/workspaceDb";
import { buildSessionTree } from "../agentSessions";
import {
  agentWorkspaceIds,
  agentWorkspaceSessionIds,
  attachSessionToWorkspace,
  filterSessionTree,
  sessionSubtreeIds,
  unassignedSessionIds,
  workspaceSessionIds,
  workspacesBySession,
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

beforeEach(async () => {
  await db.workspace_agent_sessions.clear();
  await db.workspace_agents.clear();
  await db.workspaces.clear();
  await db.workspace_sources.clear();
});

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

  it("groups the workspaces of each session for the row menus", () => {
    const bySession = workspacesBySession(links, "agent-1");
    expect([...bySession.keys()].sort()).toEqual([
      "child-b",
      "root-a",
      "root-b",
    ]);
    expect(ids(bySession.get("root-a"))).toEqual(["ws-1"]);
    expect(ids(bySession.get("root-b"))).toEqual(["ws-2"]);
    // Another agent's links never answer for this one.
    expect(workspacesBySession(links, "agent-2").get("root-a")).toEqual(
      new Set(["ws-2"]),
    );
    expect(workspacesBySession(links, "missing").size).toBe(0);
  });

  it("attaches a session only to a workspace its agent is part of", async () => {
    const workspaceId = await createWorkspace("Attachment");
    const agent = { id: "agent-1" };
    const session = { id: "session-1" };

    // The workspace does not know the agent yet, so the link would never be shown.
    expect(
      await attachSessionToWorkspace(workspaceId, agent, session),
    ).toBe(false);
    expect(await db.workspace_agent_sessions.toArray()).toEqual([]);
    // An incomplete call is a no-op rather than a broken row.
    expect(await attachSessionToWorkspace(workspaceId, agent, null)).toBe(
      false,
    );

    await attachWorkspaceAgent(workspaceId, agent.id);
    expect(await attachSessionToWorkspace(workspaceId, agent, session)).toBe(
      true,
    );

    const rows = await db.workspace_agent_sessions.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      workspaceId,
      agentId: "agent-1",
      sessionId: "session-1",
    });

    // Attaching twice keeps one link.
    await attachSessionToWorkspace(workspaceId, agent, session);
    expect(await db.workspace_agent_sessions.count()).toBe(1);
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

  it("adds the subagent subtree without the parents of a group session", () => {
    // child-b is attached alone; root-b only appears as its parent and stays open.
    expect(ids(sessionSubtreeIds(tree, ["child-b"]))).toEqual(["child-b"]);
    expect(ids(sessionSubtreeIds(tree, ["root-a"]))).toEqual([
      "child-a",
      "root-a",
    ]);
    // The sidebar passes the group's session ids as a Set.
    expect(ids(sessionSubtreeIds(tree, new Set(["root-a"])))).toEqual([
      "child-a",
      "root-a",
    ]);
    expect(ids(sessionSubtreeIds(tree, []))).toEqual([]);

    const nested = buildSessionTree([
      { id: "root", time: { updated: 3 } },
      { id: "child", parentID: "root", time: { updated: 2 } },
      { id: "grandchild", parentID: "child", time: { updated: 1 } },
    ]);
    expect(ids(sessionSubtreeIds(nested, ["root"]))).toEqual([
      "child",
      "grandchild",
      "root",
    ]);
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
