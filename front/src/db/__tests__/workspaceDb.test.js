import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveQuery } from "dexie";

import { db } from "../index";
import { deleteConversation } from "../index";
import {
  addFileReference,
  addSource,
  addWorkspaceMount,
  adoptLocalSource,
  attachWorkspaceChat,
  attachWorkspaceAgent,
  attachWorkspaceAgentSession,
  createAttachedChat,
  createWorkspace,
  deleteWorkspace,
  detachWorkspaceChat,
  detachWorkspaceAgent,
  detachWorkspaceAgentSession,
  distinctLocalSources,
  groupLocalSources,
  ensureBrowserSource,
  ensureChatStorageSource,
  ensureSaiaFsSource,
  getChatWorkspaceId,
  getSourceHandle,
  getWorkspace,
  getWorkspaceAgentSessionIds,
  listDeviceLocalSources,
  listCloneTargets,
  listWorkspaceSummaries,
  hasWorkspaceAgentSessionLink,
  removeOrphanWorkspaceAgents,
  removeWorkspaceAgentSessionLinks,
  removeSource,
  unmountLocalFolder,
  saveSourceHandle,
  seedWorkspaceAgentSessions,
  setWorkspaceMountReadOnly,
  setWorkspacePinned,
  syncAgentFilesSources,
  updateSource,
  updateWorkspace,
  chatStorageSourceId,
  syncChatStorageSources,
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

  it("stores the chosen icon and colour, defaulting a plain workspace", async () => {
    const fancyId = await createWorkspace("Fancy", {
      icon: "star",
      color: "rose",
    });
    expect(await getWorkspace(fancyId)).toMatchObject({
      icon: "star",
      color: "rose",
    });

    const plainId = await createWorkspace("Plain");
    const plain = await getWorkspace(plainId);
    expect(plain?.icon).toBe("rocket");
    expect(plain?.color).toBeUndefined();
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

  it("adds the SAIA filesystem once per workspace, on demand", async () => {
    const workspaceId = await createWorkspace("With SAIA files");

    // Availability is an async `/models` answer, so creation cannot add the row:
    // `ensureSaiaFsSource` adds it when the engine lists the service.
    expect(
      (await db.workspace_sources.where("workspaceId").equals(workspaceId).toArray())
        .map((source) => source.kind),
    ).not.toContain("saia-fs");

    const first = await ensureSaiaFsSource(workspaceId);
    const second = await ensureSaiaFsSource(workspaceId);

    expect(first).toBeTruthy();
    expect(second).toBe(first);
    const sources = await db.workspace_sources
      .where("workspaceId")
      .equals(workspaceId)
      .toArray();
    const saia = sources.filter((source) => source.kind === "saia-fs");
    expect(saia).toHaveLength(1);
    expect(saia[0]).toMatchObject({
      id: first,
      config: {},
      readOnly: false,
      status: "offline",
    });
    // Account-plane: one folder per user, not bound to this device.
    expect(saia[0].deviceId).toBeUndefined();
  });

  it("keeps one SAIA source per workspace", async () => {
    const one = await createWorkspace("First");
    const two = await createWorkspace("Second");

    const sourceId = await ensureSaiaFsSource(one);
    const otherId = await ensureSaiaFsSource(two);

    expect(otherId).not.toBe(sourceId);
    const rows = await db.workspace_sources
      .where("workspaceId")
      .anyOf(one, two)
      .filter((source) => source.kind === "saia-fs")
      .toArray();
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.workspaceId))).toEqual(
      new Set([one, two]),
    );
  });

  it("does not offer the SAIA filesystem as a clone target", async () => {
    const workspaceId = await createWorkspace("Clone source");
    const sourceId = await ensureSaiaFsSource(workspaceId);

    const targets = await listCloneTargets();

    expect(targets.map((target) => target.kind)).not.toContain("saia-fs");
    expect(targets.map((target) => target.id)).not.toContain(sourceId);
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

  it("gives another workspace its own row for a device folder", async () => {
    const first = await createWorkspace("First");
    const second = await createWorkspace("Second");
    const handle = { kind: "directory", name: "Notes" };
    const sourceId = await addSource({
      workspaceId: first,
      kind: "local",
      label: "Notes",
      config: { handleKey: "", folderName: "Notes" },
      handle,
    });

    const adopted = await adoptLocalSource(second, sourceId);
    expect(adopted).not.toBe(sourceId);
    const row = await db.workspace_sources.get(adopted);
    expect(row?.workspaceId).toBe(second);
    expect(row?.kind).toBe("local");
    expect(row?.config).toMatchObject({ folderName: "Notes" });
    expect(await getSourceHandle(adopted)).toBeTruthy();

    expect(await adoptLocalSource(second, sourceId)).toBe(adopted);
    expect(await adoptLocalSource(first, sourceId)).toBe(sourceId);
  });

  it("forgets a device folder in every workspace when unmounted", async () => {
    const first = await createWorkspace("First");
    const second = await createWorkspace("Second");
    const handle = { kind: "directory", name: "Notes" };
    const firstId = await addSource({
      workspaceId: first,
      kind: "local",
      label: "Notes",
      config: { handleKey: "", folderName: "Notes" },
      handle,
    });
    const secondId = await addSource({
      workspaceId: second,
      kind: "local",
      label: "Notes",
      config: { handleKey: "", folderName: "Notes" },
      handle,
    });
    const otherId = await addSource({
      workspaceId: second,
      kind: "local",
      label: "Other",
      config: { handleKey: "", folderName: "Other" },
      handle: { kind: "directory", name: "Other" },
    });
    await addWorkspaceMount({
      workspaceId: first,
      sourceId: firstId,
      sourcePath: "/",
      path: "/Notes",
    });
    await addWorkspaceMount({
      workspaceId: second,
      sourceId: secondId,
      sourcePath: "/",
      path: "/Notes",
    });

    await unmountLocalFolder(firstId);

    expect(await db.workspace_sources.get(firstId)).toBeUndefined();
    expect(await db.workspace_sources.get(secondId)).toBeUndefined();
    expect(await db.workspace_sources.get(otherId)).toBeTruthy();
    expect(await getSourceHandle(firstId)).toBeFalsy();
    expect(await db.workspace_mounts.toArray()).toHaveLength(0);
  });

  it("lists one device row per folder, not one per workspace", async () => {
    const first = await createWorkspace("First");
    const second = await createWorkspace("Second");
    const putLocal = (workspaceId, id) =>
      db.workspace_sources.put({
        id,
        workspaceId,
        kind: "local",
        label: "Docs",
        deviceId: getDeviceId(),
        config: { handleKey: "", folderName: "Docs" },
        capabilities: {},
        readOnly: false,
        status: "offline",
        createdAt: 1,
        lastModified: 1,
      });
    const inFirst = "local-first";
    const inSecond = "local-second";
    const sameNameOtherFolder = "local-other";
    await putLocal(first, inFirst);
    await putLocal(second, inSecond);
    await putLocal(second, sameNameOtherFolder);

    const shared = {
      kind: "directory",
      name: "Docs",
      key: "docs-1",
      isSameEntry: async (candidate) => candidate?.key === "docs-1",
    };
    const other = {
      kind: "directory",
      name: "Docs",
      key: "docs-2",
      isSameEntry: async (candidate) => candidate?.key === "docs-2",
    };
    const handles = new Map([
      [inFirst, shared],
      [inSecond, shared],
      [sameNameOtherFolder, other],
    ]);

    const rows = await listDeviceLocalSources();
    expect(rows.map((row) => row.id)).toEqual(
      expect.arrayContaining([inFirst, inSecond, sameNameOtherFolder]),
    );

    const distinct = await groupLocalSources(rows, handles, second);
    const ids = distinct.map((row) => row.id);
    expect(ids).toContain(inSecond);
    expect(ids).toContain(sameNameOtherFolder);
    expect(ids).not.toContain(inFirst);
  });

  it("still lists a folder once when its handles cannot be compared", async () => {
    const first = await createWorkspace("First");
    const second = await createWorkspace("Second");
    const rows = [
      { id: "a", workspaceId: first, label: "Docs", config: { folderName: "Docs" } },
      { id: "b", workspaceId: second, label: "Docs", config: { folderName: "Docs" } },
    ].map((row) => ({
      ...row,
      kind: "local",
      capabilities: {},
      status: "offline",
      createdAt: 1,
      lastModified: 1,
    }));

    const distinct = await groupLocalSources(rows, new Map(), second);
    expect(distinct).toHaveLength(1);
    expect(distinct[0].id).toBe("b");
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

  it("links an attached chat's own folder into the workspace", async () => {
    const workspaceId = await createWorkspace("Chat folders");
    await db.conversations.put({
      id: "chat-1",
      title: "Trip planning",
      settings: {},
      createdAt: 1,
      lastModified: 1,
    });

    await attachWorkspaceChat(workspaceId, "chat-1");
    const source = await db.workspace_sources.get(
      chatStorageSourceId(workspaceId, "chat-1"),
    );
    expect(source).toMatchObject({
      kind: "chat",
      label: "Trip planning",
      config: { conversationId: "chat-1" },
    });
    const mount = await db.workspace_mounts
      .where("sourceId")
      .equals(source.id)
      .first();
    expect(mount).toMatchObject({
      path: "/chats/chat-1",
      sourcePath: "/",
      readOnly: false,
    });

    // The link is idempotent: syncing again neither duplicates nor rewrites anything.
    const before = await db.workspace_sources.get(source.id);
    await syncChatStorageSources(workspaceId, [
      { id: "chat-1", title: "Trip planning" },
    ]);
    expect(await db.workspace_sources.count()).toBe(3);
    expect((await db.workspace_sources.get(source.id))?.lastModified).toBe(
      before.lastModified,
    );

    // A title change follows through to the label.
    await syncChatStorageSources(workspaceId, [
      { id: "chat-1", title: "Renamed trip" },
    ]);
    expect((await db.workspace_sources.get(source.id))?.label).toBe(
      "Renamed trip",
    );

    // Detaching only unlinks: the files stay with the chat.
    await detachWorkspaceChat(workspaceId, "chat-1");
    expect(await db.workspace_sources.get(source.id)).toBeUndefined();
    expect(await db.workspace_mounts.count()).toBe(0);
  });

  it("creates a new chat and attaches it in one step", async () => {
    const workspaceId = await createWorkspace("New chats");
    const id = await createAttachedChat(workspaceId, {
      title: "Fresh chat",
      settings: {},
    });

    expect(id).toEqual(expect.any(String));
    expect((await db.conversations.get(id))?.title).toBe("Fresh chat");
    const link = await db.workspace_chats
      .where("workspaceId")
      .equals(workspaceId)
      .first();
    expect(link).toMatchObject({ conversationId: id });
    const mount = await db.workspace_mounts
      .where("workspaceId")
      .equals(workspaceId)
      .and((row) => row.path === `/chats/${id}`)
      .first();
    expect(mount).toBeTruthy();

    await deleteConversation(id);
  });

  it("does not collide when a chat folder is reconciled concurrently", async () => {
    const workspaceId = await createWorkspace("Chat race");
    // The workspace page reconciles while the chat is being attached, so both
    // create-if-missing calls can run at the same time.
    await Promise.all([
      ensureChatStorageSource(workspaceId, "chat-race", "Race"),
      ensureChatStorageSource(workspaceId, "chat-race", "Race"),
    ]);

    expect(
      await db.workspace_sources
        .where("workspaceId")
        .equals(workspaceId)
        .and((source) => source.kind === "chat")
        .count(),
    ).toBe(1);
    expect(await db.workspace_mounts.count()).toBe(1);
  });

  it("drops the chat folder when the chat is deleted", async () => {
    const workspaceId = await createWorkspace("Chat folders");
    await db.conversations.put({
      id: "chat-2",
      title: "Doomed",
      settings: {},
      createdAt: 1,
      lastModified: 1,
    });
    await attachWorkspaceChat(workspaceId, "chat-2");
    const sourceId = chatStorageSourceId(workspaceId, "chat-2");
    expect(await db.workspace_sources.get(sourceId)).toBeTruthy();

    await deleteConversation("chat-2");
    expect(await db.workspace_sources.get(sourceId)).toBeUndefined();
    expect(await db.workspace_mounts.where("sourceId").equals(sourceId).count()).toBe(
      0,
    );
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
