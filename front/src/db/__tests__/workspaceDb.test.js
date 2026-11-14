import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "../index";
import {
  addSource,
  addWorkspaceMount,
  attachWorkspaceChat,
  createWorkspace,
  deleteWorkspace,
  detachWorkspaceChat,
  getSourceHandle,
  getWorkspace,
  removeSource,
  saveSourceHandle,
  setWorkspaceMountReadOnly,
  updateSource,
  updateWorkspace,
} from "../workspaceDb";
import { getDeviceId } from "../../workspace/deviceId";

const reset = async () => {
  await db.workspaces.clear();
  await db.workspace_sources.clear();
  await db.workspace_handles.clear();
  await db.workspace_transfers.clear();
  await db.workspace_mounts.clear();
  await db.workspace_chats.clear();
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
    await detachWorkspaceChat(workspaceId, "chat-1");
    expect(await db.workspace_chats.count()).toBe(0);

    await attachWorkspaceChat(workspaceId, "chat-2");
    await deleteWorkspace(workspaceId);
    expect(await db.workspace_mounts.count()).toBe(0);
    expect(await db.workspace_chats.count()).toBe(0);
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
