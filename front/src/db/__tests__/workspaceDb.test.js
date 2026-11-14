import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "../index";
import {
  addFileReference,
  addSource,
  addWorkspaceMount,
  attachWorkspaceChat,
  attachWorkspaceAgent,
  createWorkspace,
  deleteWorkspace,
  detachWorkspaceChat,
  detachWorkspaceAgent,
  getChatWorkspaceId,
  getSourceHandle,
  getWorkspace,
  removeOrphanWorkspaceAgents,
  removeSource,
  saveSourceHandle,
  setWorkspaceMountReadOnly,
  updateSource,
  updateWorkspace,
} from "../workspaceDb";
import { getDeviceId } from "../../workspace/deviceId";
import { writeSourceFile } from "../workspaceVfs";

const reset = async () => {
  await db.workspaces.clear();
  await db.workspace_sources.clear();
  await db.workspace_handles.clear();
  await db.workspace_transfers.clear();
  await db.workspace_mounts.clear();
  await db.workspace_chats.clear();
  await db.workspace_agents.clear();
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
    const sourceId = await addSource({
      workspaceId,
      kind: "browser",
      label: "Browser",
      config: { storage: "indexeddb" },
    });
    const rootSourceId = `workspace-root:${workspaceId}`;
    const bytes = new Uint8Array([1, 2, 3]);

    const rootKeep = await writeSourceFile(rootSourceId, "/folder/keep.txt", bytes);
    const rootDrop = await writeSourceFile(rootSourceId, "/folder/drop.txt", bytes);
    const sourceKeep = await writeSourceFile(sourceId, "/keep.txt", bytes);
    const sourceDrop = await writeSourceFile(sourceId, "/drop.txt", bytes);

    await addFileReference({
      conversationId: "chat-1",
      workspaceId,
      sourceId: rootSourceId,
      nodeId: rootKeep.id,
      name: "keep.txt",
      path: rootKeep.path,
    });
    await addFileReference({
      conversationId: "chat-1",
      workspaceId,
      sourceId,
      nodeId: sourceKeep.id,
      name: "keep.txt",
      path: sourceKeep.path,
    });

    await deleteWorkspace(workspaceId);

    expect(await db.workspace_nodes.get(rootKeep.id)).toBeDefined();
    expect(await db.workspace_blobs.get(rootKeep.id)).toBeDefined();
    expect(await db.workspace_nodes.get(rootDrop.id)).toBeUndefined();
    expect(await db.workspace_blobs.get(rootDrop.id)).toBeUndefined();
    expect(await db.workspace_nodes.get(sourceKeep.id)).toBeDefined();
    expect(await db.workspace_nodes.get(sourceDrop.id)).toBeUndefined();

    // The ancestor directory stays with its referenced file.
    const folder = await db.workspace_nodes
      .where("[sourceId+path]")
      .equals([rootSourceId, "/folder"])
      .first();
    expect(folder).toBeDefined();
    expect(await db.workspace_file_references.count()).toBe(2);
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
