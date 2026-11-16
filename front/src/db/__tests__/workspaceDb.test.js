import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveQuery } from "dexie";

import { db } from "../index";
import {
  addFileReference,
  addSource,
  addWorkspaceMount,
  attachWorkspaceChat,
  attachWorkspaceAgent,
  attachWorkspaceAgentSession,
  createWorkspace,
  deleteWorkspace,
  detachWorkspaceChat,
  detachWorkspaceAgent,
  detachWorkspaceAgentSession,
  ensureBrowserSource,
  getChatWorkspaceId,
  getSourceHandle,
  getWorkspace,
  getWorkspaceAgentSessionIds,
  listWorkspaceSummaries,
  hasWorkspaceAgentSessionLink,
  removeOrphanWorkspaceAgents,
  removeWorkspaceAgentSessionLinks,
  removeSource,
  saveSourceHandle,
  seedWorkspaceAgentSessions,
  setWorkspaceMountReadOnly,
  setWorkspacePinned,
  syncAgentFilesSources,
  updateSource,
  updateWorkspace,
} from "../workspaceDb";
import { getDeviceId } from "../../workspace/deviceId";
import { workspaceBrowserStorageId } from "../../workspace/browserStorage";
import { writeSourceFile } from "../workspaceVfs";

const reset = async () => {
  await db.workspaces.clear();
  await db.workspace_sources.clear();
  await db.workspace_handles.clear();
  await db.workspace_transfers.clear();
  await db.workspace_mounts.clear();
  await db.workspace_chats.clear();
  await db.workspace_agents.clear();
  await db.workspace_agent_sessions.clear();
  await db.workspace_nodes.clear();
  await db.workspace_blobs.clear();
  await db.workspace_file_references.clear();
};

describe("workspace database", () => {
  beforeEach(reset);
  afterEach(reset);

  it("creates workspaces with unique names", async () => {
    const id = await createWorkspace("  Research  ");
    const workspace = await getWorkspace(id);
    expect(workspace?.name).toBe("Research");

    await expect(createWorkspace("research")).rejects.toThrow("already exists");
    await expect(createWorkspace("   ")).rejects.toThrow("required");

    await updateWorkspace(id, { name: "Renamed" });
    expect((await getWorkspace(id))?.name).toBe("Renamed");
    await createWorkspace("Other");
    await expect(updateWorkspace(id, { name: "other" })).rejects.toThrow(
      "already exists",
    );
  });

  it("pins workspaces and exposes their timestamps", async () => {
    const workspaceId = await createWorkspace("Pinned workspace");
    const created = await getWorkspace(workspaceId);

    await setWorkspacePinned(workspaceId, true);
    const pinned = await getWorkspace(workspaceId);
    expect(pinned?.pinned).toBe(true);
    expect(pinned?.createdAt).toBe(created?.createdAt);
    expect(pinned?.lastModified).toBeGreaterThanOrEqual(
      created?.lastModified ?? 0,
    );

    const summaries = await listWorkspaceSummaries();
    expect(summaries.find((item) => item.id === workspaceId)).toMatchObject({
      pinned: true,
      createdAt: created?.createdAt,
      lastModified: pinned?.lastModified,
    });

    await setWorkspacePinned(workspaceId, false);
    expect((await getWorkspace(workspaceId))?.pinned).toBe(false);
  });

  it("adds browser and Arcana filesystem sources to new workspaces", async () => {
    const workspaceId = await createWorkspace("With defaults");
    const sources = await db.workspace_sources
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();
    expect(sources.map((source) => source.kind).sort()).toEqual([
      "arcana-filesystem",
      "browser",
    ]);
    expect(
      sources.find((source) => source.kind === "browser"),
    ).toMatchObject({
      config: { storage: "indexeddb" },
      readOnly: false,
    });
  });

  it("keeps the browser source when Arcanas are disabled", async () => {
    const original = import.meta.env.VITE_MODULE_ARCANAS;
    import.meta.env.VITE_MODULE_ARCANAS = "false";
    try {
      const workspaceId = await createWorkspace("Without Arcana");
      const sources = await db.workspace_sources
        .where("workspaceId")
        .equals(workspaceId)
        .toArray();
      expect(sources.map((source) => source.kind)).toEqual(["browser"]);
    } finally {
      import.meta.env.VITE_MODULE_ARCANAS = original;
    }
  });

  it("binds device-plane sources to this device and leaves Arcana device-free", async () => {
    const workspaceId = await createWorkspace("Mixed");
    const browserId = await addSource({
      workspaceId,
      kind: "browser",
      label: "Browser",
      config: { storage: "opfs" },
    });
    const arcanaId = await addSource({
      workspaceId,
      kind: "arcana",
      label: "Arcana",
      config: { remoteWorkspaceId: "research" },
    });

    const sources = await db.workspace_sources.toArray();
    const browser = sources.find((source) => source.id === browserId);
    const arcana = sources.find((source) => source.id === arcanaId);
    expect(browser?.deviceId).toBe(getDeviceId());
    expect(arcana?.deviceId).toBeUndefined();

    await removeSource(browserId);
    expect(await db.workspace_sources.get(browserId)).toBeUndefined();
  });

  it("mounts source folders and attaches chats to workspaces", async () => {
    const workspaceId = await createWorkspace("Mounts");
    const sourceId = await addSource({
      workspaceId,
      kind: "browser",
      label: "Browser",
      config: { storage: "opfs" },
    });
    const mountId = await addWorkspaceMount({
      workspaceId,
      sourceId,
      sourcePath: "/shoe",
      path: "/shoe",
      readOnly: true,
    });
    const mount = await db.workspace_mounts.get(mountId);
    expect(mount?.path).toBe("/shoe");
    expect(mount?.sourcePath).toBe("/shoe");
    expect(mount?.readOnly).toBe(true);
    await setWorkspaceMountReadOnly(mountId, false);
    expect((await db.workspace_mounts.get(mountId))?.readOnly).toBe(false);

    await attachWorkspaceChat(workspaceId, "chat-1");
    await attachWorkspaceChat(workspaceId, "chat-1");
    expect(await db.workspace_chats.count()).toBe(1);
    expect(await getChatWorkspaceId("chat-1")).toBe(workspaceId);
    await detachWorkspaceChat(workspaceId, "chat-1");
    expect(await db.workspace_chats.count()).toBe(0);

    await attachWorkspaceChat(workspaceId, "chat-2");
    await deleteWorkspace(workspaceId);
    expect(await db.workspace_mounts.count()).toBe(0);
    expect(await db.workspace_chats.count()).toBe(0);
  });

  it("attaches agents to workspaces and removes orphan links", async () => {
    const workspaceId = await createWorkspace("Agent links");
    await attachWorkspaceAgent(workspaceId, "agent-1");
    await attachWorkspaceAgent(workspaceId, "agent-1");
    expect(await db.workspace_agents.count()).toBe(1);

    await attachWorkspaceAgent(workspaceId, "agent-2");
    await removeOrphanWorkspaceAgents(["agent-1"]);
    const links = await db.workspace_agents.toArray();
    expect(links.map((link) => link.agentId)).toEqual(["agent-1"]);

    await detachWorkspaceAgent(workspaceId, "agent-1");
    expect(await db.workspace_agents.count()).toBe(0);
  });

  it("attaches agent sessions per workspace instead of everywhere", async () => {
    const first = await createWorkspace("First");
    const second = await createWorkspace("Second");
    await attachWorkspaceAgent(first, "agent-1");
    await attachWorkspaceAgent(second, "agent-1");

    await attachWorkspaceAgentSession(first, "agent-1", "session-1");
    await attachWorkspaceAgentSession(first, "agent-1", "session-1");
    await attachWorkspaceAgentSession(first, "agent-1", "session-2");
    await attachWorkspaceAgentSession(second, "agent-1", "session-2");
    expect(await db.workspace_agent_sessions.count()).toBe(3);
    expect(
      (await getWorkspaceAgentSessionIds(first, "agent-1")).sort(),
    ).toEqual(["session-1", "session-2"]);
    expect(await hasWorkspaceAgentSessionLink(first, "agent-1", "session-2")).toBe(
      true,
    );
    expect(await hasWorkspaceAgentSessionLink(second, "agent-1", "session-1")).toBe(
      false,
    );

    await detachWorkspaceAgentSession(first, "agent-1", "session-1");
    expect(await db.workspace_agent_sessions.count()).toBe(2);

    // Closing a session removes it from every workspace it was attached to.
    await removeWorkspaceAgentSessionLinks("agent-1", "session-2");
    expect(await getWorkspaceAgentSessionIds(second, "agent-1")).toEqual([]);
    await attachWorkspaceAgentSession(first, "agent-1", "session-2");
    await attachWorkspaceAgentSession(second, "agent-1", "session-2");

    // Detaching the agent also drops the sessions attached through it.
    await detachWorkspaceAgent(first, "agent-1");
    expect(await getWorkspaceAgentSessionIds(first, "agent-1")).toEqual([]);
    expect(
      (await getWorkspaceAgentSessionIds(second, "agent-1")).sort(),
    ).toEqual(["session-2"]);

    await deleteWorkspace(second);
    expect(await db.workspace_agent_sessions.count()).toBe(0);
  });

  it("seeds an attached agent's active session once", async () => {
    const workspaceId = await createWorkspace("Seeded");
    await attachWorkspaceAgent(workspaceId, "agent-1");
    await attachWorkspaceAgent(workspaceId, "agent-2");

    await seedWorkspaceAgentSessions(workspaceId, [
      { id: "agent-1", sessionId: "session-1" },
      { id: "agent-2", sessionId: "" },
    ]);
    expect(await getWorkspaceAgentSessionIds(workspaceId, "agent-1")).toEqual([
      "session-1",
    ]);
    expect(await getWorkspaceAgentSessionIds(workspaceId, "agent-2")).toEqual([]);

    // The pair is marked as seeded, so a detached session is not re-added.
    await detachWorkspaceAgentSession(workspaceId, "agent-1", "session-1");
    await seedWorkspaceAgentSessions(workspaceId, [
      { id: "agent-1", sessionId: "session-1" },
    ]);
    expect(await getWorkspaceAgentSessionIds(workspaceId, "agent-1")).toEqual([]);
  });

  it("removes session links of removed agents", async () => {
    const workspaceId = await createWorkspace("Orphans");
    await attachWorkspaceAgent(workspaceId, "agent-1");
    await attachWorkspaceAgentSession(workspaceId, "agent-1", "session-1");
    await removeOrphanWorkspaceAgents([]);
    expect(await db.workspace_agent_sessions.count()).toBe(0);
  });

  it("keeps agent-files sources in sync with attach, detach and removal", async () => {
    const workspaceId = await createWorkspace("Agent files");
    const workspaceAgentSources = async () =>
      (
        await db.workspace_sources
          .where("workspaceId")
          .equals(workspaceId)
          .toArray()
      ).filter((source) => source.kind === "agent");
    const agent = { id: "agent-1", name: "HPC agent", local: true };

    await attachWorkspaceAgent(workspaceId, agent.id);
    await syncAgentFilesSources(workspaceId, [agent]);
    expect(await workspaceAgentSources()).toMatchObject([
      {
        id: `agent-files:${workspaceId}:agent-1`,
        label: "HPC agent",
        readOnly: true,
      },
    ]);

    // Renaming the agent updates the source label.
    await syncAgentFilesSources(workspaceId, [{ ...agent, name: "Renamed" }]);
    expect((await workspaceAgentSources())[0].label).toBe("Renamed");

    // Detaching the agent removes the derived source.
    await detachWorkspaceAgent(workspaceId, agent.id);
    await syncAgentFilesSources(workspaceId, [agent]);
    expect(await workspaceAgentSources()).toHaveLength(0);

    // An agent bridged to the workspace keeps a source without a workspace link.
    await syncAgentFilesSources(workspaceId, [
      { ...agent, bridgeWorkspaceId: workspaceId },
    ]);
    expect(await workspaceAgentSources()).toHaveLength(1);

    // Deleting the agent removes its source.
    await syncAgentFilesSources(workspaceId, []);
    expect(await workspaceAgentSources()).toHaveLength(0);
  });

  it("marks a source read-only", async () => {
    const workspaceId = await createWorkspace("ReadOnly");
    const sourceId = await addSource({
      workspaceId,
      kind: "browser",
      label: "Browser",
      config: { storage: "indexeddb" },
      readOnly: true,
    });
    expect((await db.workspace_sources.get(sourceId))?.readOnly).toBe(true);
    await updateSource(sourceId, { readOnly: false });
    expect((await db.workspace_sources.get(sourceId))?.readOnly).toBe(false);
  });

  it("keeps browser files referenced by a chat when deleting the workspace", async () => {
    const workspaceId = await createWorkspace("Refs");
    await addSource({
      workspaceId,
      kind: "browser",
      label: "Browser",
      config: { storage: "indexeddb" },
    });
    const treeId = workspaceBrowserStorageId(workspaceId);
    const bytes = new Uint8Array([1, 2, 3]);

    const keep = await writeSourceFile(treeId, "/folder/keep.txt", bytes);
    const drop = await writeSourceFile(treeId, "/folder/drop.txt", bytes);

    await addFileReference({
      conversationId: "chat-1",
      workspaceId,
      sourceId: treeId,
      nodeId: keep.id,
      name: "keep.txt",
      path: keep.path,
    });

    await deleteWorkspace(workspaceId);

    expect(await db.workspace_nodes.get(keep.id)).toBeDefined();
    expect(await db.workspace_blobs.get(keep.id)).toBeDefined();
    expect(await db.workspace_nodes.get(drop.id)).toBeUndefined();
    expect(await db.workspace_blobs.get(drop.id)).toBeUndefined();

    // The ancestor directory stays with its referenced file.
    const folder = await db.workspace_nodes
      .where("[sourceId+path]")
      .equals([treeId, "/folder"])
      .first();
    expect(folder).toBeDefined();
    expect(await db.workspace_file_references.count()).toBe(1);
  });

  it("does not touch another workspace's browser files when deleting a workspace", async () => {
    const first = await createWorkspace("First");
    const second = await createWorkspace("Second");
    await writeSourceFile(
      workspaceBrowserStorageId(first),
      "/first.txt",
      new Uint8Array([1]),
    );
    const secondFile = await writeSourceFile(
      workspaceBrowserStorageId(second),
      "/second.txt",
      new Uint8Array([2]),
    );

    await deleteWorkspace(first);

    expect(
      await db.workspace_nodes
        .where("sourceId")
        .equals(workspaceBrowserStorageId(first))
        .count(),
    ).toBe(0);
    expect(await db.workspace_nodes.get(secondFile.id)).toBeDefined();
  });

  it("keeps the workspace files when a browser source is removed", async () => {
    const workspaceId = await createWorkspace("Browser source");
    const sourceId = await ensureBrowserSource(workspaceId);
    const file = await writeSourceFile(
      workspaceBrowserStorageId(workspaceId),
      "/kept.txt",
      new Uint8Array([1]),
    );

    await removeSource(sourceId);

    expect(await db.workspace_sources.get(sourceId)).toBeUndefined();
    expect(await db.workspace_nodes.get(file.id)).toBeDefined();
  });

  it("stores a folder handle before the local source becomes visible", async () => {
    const workspaceId = await createWorkspace("Local");
    const sourceId = "local-handle-source";
    const handle = { name: "Folder", kind: "directory" };
    let handleAtFirstSighting;

    // This is what the workspace page does: it connects every source a live query reports.
    const subscription = liveQuery(() => db.workspace_sources.toArray()).subscribe({
      next: async (sources) => {
        if (!sources.some((source) => source.id === sourceId)) return;
        if (handleAtFirstSighting !== undefined) return;
        handleAtFirstSighting = (await getSourceHandle(sourceId)) ?? null;
      },
    });

    try {
      await addSource({
        id: sourceId,
        workspaceId,
        kind: "local",
        label: "Folder",
        config: { handleKey: "" },
        handle,
      });

      await vi.waitFor(() =>
        expect(handleAtFirstSighting).not.toBeUndefined(),
      );
      expect(handleAtFirstSighting).toEqual(handle);
    } finally {
      subscription.unsubscribe();
    }
  });

  it("stores folder handles and deletes sources with the workspace", async () => {
    const workspaceId = await createWorkspace("Local");
    const sourceId = await addSource({
      workspaceId,
      kind: "local",
      label: "Folder",
      config: { handleKey: "" },
    });
    const handle = { name: "Folder", kind: "directory" };
    await saveSourceHandle(sourceId, handle);
    expect(await getSourceHandle(sourceId)).toEqual(handle);

    await deleteWorkspace(workspaceId);
    expect(await db.workspaces.get(workspaceId)).toBeUndefined();
    expect(await db.workspace_sources.get(sourceId)).toBeUndefined();
    expect(await getSourceHandle(sourceId)).toBeUndefined();
  });
});
