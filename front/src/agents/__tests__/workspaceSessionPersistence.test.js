import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apis/opencodeAgents", () => ({
  opencodeDefaults: () => ({
    serverUrl: "http://localhost:9999",
    username: "opencode",
    password: "secret",
  }),
}));

const STORAGE_KEY = "chatai.agents";

// The agent store keeps its rows in module state and reads localStorage on import,
// while the workspace links live in IndexedDB. Re-importing the module graph is
// therefore what a page reload looks like: localStorage and Dexie survive, the
// in-memory agent list is rebuilt from scratch.
const reload = async () => {
  vi.resetModules();
  const [{ db }, workspaceDb, agentStore] = await Promise.all([
    import("../../db"),
    import("../../db/workspaceDb"),
    import("../agentStore"),
  ]);
  return { db, ...workspaceDb, ...agentStore };
};

const sessionLinks = async (db, workspaceId) => {
  const links = await db.workspace_agent_sessions
    .where("workspaceId")
    .equals(workspaceId)
    .toArray();
  return links.map((link) => link.sessionId).sort();
};

beforeEach(async () => {
  localStorage.clear();
  const { db } = await reload();
  await db.workspace_agent_sessions.clear();
  await db.workspace_agents.clear();
  await db.workspaces.clear();
  await db.workspace_sources.clear();
});

describe("workspace agent sessions across a reload", () => {
  it("keeps the active session attached and does not seed it twice", async () => {
    let api = await reload();
    const workspaceId = await api.createWorkspace("Research");

    api.addAgent({
      id: "agent-1",
      name: "Agent",
      serverUrl: "http://localhost:9999",
      sessionId: "session-1",
    });
    await api.attachWorkspaceAgent(workspaceId, "agent-1");
    await api.seedWorkspaceAgentSessions(workspaceId, api.getAgents());
    expect(await sessionLinks(api.db, workspaceId)).toEqual(["session-1"]);

    api = await reload();
    expect(api.getAgent("agent-1")?.sessionId).toBe("session-1");

    // What WorkspacePage runs on mount: prune links of agents this tab does not know,
    // then seed the agents it does know.
    await api.removeOrphanWorkspaceAgents(
      api.getAgents().map((agent) => agent.id),
    );
    await api.seedWorkspaceAgentSessions(workspaceId, api.getAgents());

    expect(await sessionLinks(api.db, workspaceId)).toEqual(["session-1"]);
    expect(await api.db.workspace_agent_sessions.count()).toBe(1);
    expect(await api.db.workspace_agents.count()).toBe(1);
  });

  it("removes the workspace links when the agent itself is removed", async () => {
    const api = await reload();
    const workspaceId = await api.createWorkspace("Research");
    api.addAgent({
      id: "agent-1",
      name: "Agent",
      serverUrl: "http://localhost:9999",
      sessionId: "session-1",
    });
    await api.attachWorkspaceAgent(workspaceId, "agent-1");
    await api.seedWorkspaceAgentSessions(workspaceId, api.getAgents());

    api.removeAgent("agent-1");

    // removeAgent cleans up asynchronously (the DB layer is imported lazily).
    await vi.waitFor(async () => {
      expect(await api.db.workspace_agents.count()).toBe(0);
      expect(await api.db.workspace_agent_sessions.count()).toBe(0);
    });
    // The prune on the next workspace page is idempotent.
    await api.removeOrphanWorkspaceAgents([]);
    expect(await sessionLinks(api.db, workspaceId)).toEqual([]);
  });
});

describe("agent store across tabs", () => {
  it("picks up an agent added in another tab instead of treating it as deleted", async () => {
    const api = await reload();
    expect(api.getAgents()).toEqual([]);

    // Another tab writes the shared localStorage entry.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "agent-1",
          name: "Other tab",
          serverUrl: "http://localhost:9999",
          sessionId: "session-1",
        },
      ]),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: localStorage.getItem(STORAGE_KEY),
      }),
    );

    expect(api.getAgents().map((agent) => agent.id)).toEqual(["agent-1"]);
    expect(api.getAgent("agent-1")?.sessionId).toBe("session-1");
  });

  it("follows a cleared localStorage (a `key: null` storage event)", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "agent-1", name: "Agent", serverUrl: "http://localhost:9999" },
      ]),
    );
    const api = await reload();
    expect(api.getAgent("agent-1")).toBeTruthy();

    localStorage.clear();
    window.dispatchEvent(
      new StorageEvent("storage", { key: null, newValue: null }),
    );

    expect(api.getAgents()).toEqual([]);
  });

  it("notifies subscribers when another tab changes the list", async () => {
    const api = await reload();
    const listener = vi.fn();
    const unsubscribe = api.subscribeAgents(listener);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "agent-1", name: "Agent", serverUrl: "http://localhost:9999" },
      ]),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: localStorage.getItem(STORAGE_KEY),
      }),
    );

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});
