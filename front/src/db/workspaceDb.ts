import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import i18n from "../i18n";
import { isArcanasEnabled } from "../utils/modules";

import { db, createConversation, newId } from "./index";
import type {
  SourceKind,
  WorkspaceRow,
  WorkspaceSourceRow,
  TransferJobRow,
  WorkspaceMountRow,
  WorkspaceChatRow,
  WorkspaceAgentRow,
  WorkspaceAgentSessionRow,
  WorkspaceFileReferenceRow,
} from "./dbTypes";
import { defaultCapabilities } from "../workspace/capabilities";
import { getDeviceId, DEVICE_PLANE_KINDS } from "../workspace/deviceId";
import { workspaceBrowserStorageId } from "../workspace/browserStorage";
import {
  chatStorageMountPath,
  chatStorageSourceId,
} from "../workspace/chatStorage";


export { getDeviceId } from "../workspace/deviceId";

const now = () => Date.now();

// Browser nodes referenced by a chat are kept when their workspace is deleted. Keep their
// ancestor directories too, so the remaining rows still form a usable tree.
async function deleteUnreferencedSourceNodes(sourceId: string): Promise<void> {
  const [nodes, references] = await Promise.all([
    db.workspace_nodes.where("sourceId").equals(sourceId).toArray(),
    db.workspace_file_references.where("sourceId").equals(sourceId).toArray(),
  ]);
  if (nodes.length === 0) return;

  const kept = new Set(references.map((reference) => reference.nodeId));
  const byPath = new Map(nodes.map((node) => [node.path, node]));
  for (const nodeId of [...kept]) {
    let node = nodes.find((item) => item.id === nodeId);
    while (node?.parentPath && node.parentPath !== "/") {
      const parent = byPath.get(node.parentPath);
      if (!parent) break;
      kept.add(parent.id);
      node = parent;
    }
  }

  const ids = nodes
    .filter((node) => !kept.has(node.id))
    .map((node) => node.id);
  if (ids.length === 0) return;
  await db.transaction(
    "rw",
    [db.workspace_nodes, db.workspace_blobs],
    async () => {
      await db.workspace_nodes.bulkDelete(ids);
      await db.workspace_blobs.bulkDelete(ids);
    },
  );
}

export type AddFileReferenceInput = {
  conversationId: string;
  workspaceId: string;
  sourceId: string;
  nodeId: string;
  name?: string;
  path?: string;
};

/** Remember that a chat uses a file from a workspace's browser storage. */
export async function addFileReference(
  input: AddFileReferenceInput,
): Promise<string> {
  const existing = await db.workspace_file_references
    .where("conversationId")
    .equals(input.conversationId)
    .and(
      (reference) =>
        reference.sourceId === input.sourceId &&
        reference.nodeId === input.nodeId,
    )
    .first();
  if (existing) return existing.id;
  const reference: WorkspaceFileReferenceRow = {
    id: newId(),
    ...input,
    createdAt: now(),
  };
  await db.workspace_file_references.add(reference);
  return reference.id;
}

export async function getWorkspaceSource(id: string): Promise<WorkspaceSourceRow | undefined> {
  return id ? db.workspace_sources.get(id) : undefined;
}

export async function listCloneTargets() {
  const [sources, workspaces] = await Promise.all([
    db.workspace_sources.toArray(),
    db.workspaces.toArray(),
  ]);
  const names = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));
  return sources
    .filter(
      (source) =>
        source.kind !== "browser" &&
        source.kind !== "arcana" &&
        source.kind !== "arcana-filesystem" &&
        source.kind !== "agent" &&
        // A chat's folder is derived: its files belong to the chat, not to a clone target.
        source.kind !== "chat" &&
        source.readOnly !== true &&
        (!source.deviceId || source.deviceId === getDeviceId()) &&
        source.capabilities?.write === true &&
        source.capabilities?.mkdir === true,
    )
    .map((source) => ({
      id: source.id,
      kind: source.kind,
      label: source.label,
      workspaceId: source.workspaceId,
      workspaceName: names.get(source.workspaceId) ?? "",
      source,
    }))
    .sort((left, right) =>
      `${left.workspaceName}:${left.label}`.localeCompare(
        `${right.workspaceName}:${right.label}`,
      ),
    );
}

export async function createWorkspace(
  name: string,
  options: { icon?: string; color?: string } = {},
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Workspace name is required");
  const existing = await db.workspaces.toArray();
  if (
    existing.some(
      (workspace) => workspace.name.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    throw new Error("A workspace with this name already exists");
  }
  const id = newId();
  const icon =
    typeof options.icon === "string" && options.icon.trim()
      ? options.icon
      : "rocket";
  const color =
    typeof options.color === "string" && options.color.trim()
      ? options.color
      : undefined;
  const workspace: WorkspaceRow = {
    id,
    name: trimmed,
    icon,
    ...(color ? { color } : {}),
    createdAt: now(),
    lastModified: now(),
  };
  await db.workspaces.add(workspace);
  await ensureBrowserSource(id);
  await ensureArcanaFilesystemSource(id);
  return id;
}

/** Every workspace gets a browser-storage source; its tree is private to the workspace. */
export async function ensureBrowserSource(
  workspaceId: string,
): Promise<string> {
  const existing = await db.workspace_sources
    .where("[workspaceId+kind]")
    .equals([workspaceId, "browser"])
    .first();
  if (existing) return existing.id;
  return addSource({
    workspaceId,
    kind: "browser",
    label: i18n.t("workspace.source_browser_label"),
    config: { storage: "indexeddb" },
    status: "offline",
  });
}

const AGENT_FILES_SOURCE_PREFIX = "agent-files:";

/** A read-only workspace source backed by a local agent's OpenCode filesystem. */
export async function ensureAgentFilesSource(
  workspaceId: string,
  agent: { id: string; name?: string },
): Promise<string> {
  const id = `${AGENT_FILES_SOURCE_PREFIX}${workspaceId}:${agent.id}`;
  const label = String(agent.name || "").trim() || "Agent files";
  const existing = await db.workspace_sources.get(id);
  if (existing) {
    if (
      existing.label !== label ||
      (existing.config as any)?.agentId !== agent.id
    ) {
      await updateSource(id, { label, config: { agentId: agent.id } });
    }
    return id;
  }
  return addSource({
    id,
    workspaceId,
    kind: "agent",
    label,
    config: { agentId: agent.id },
    readOnly: true,
    status: "offline",
  });
}

/** Keep one agent-files source per local agent attached to the workspace. */
export async function syncAgentFilesSources(
  workspaceId: string,
  agents: { id: string; name?: string; local?: boolean; bridgeWorkspaceId?: string }[],
): Promise<void> {
  if (!workspaceId) return;
  // Read the links here instead of trusting a caller's live query: on first render those
  // queries still return their empty placeholder, which must not delete every source.
  const links = await db.workspace_agents
    .where("workspaceId")
    .equals(workspaceId)
    .toArray();
  const attachedIds = new Set(links.map((link) => link.agentId));
  const desired = (agents || []).filter(
    (agent) =>
      agent?.id &&
      agent.local !== false &&
      (attachedIds.has(agent.id) || agent.bridgeWorkspaceId === workspaceId),
  );
  await Promise.all(
    desired.map((agent) => ensureAgentFilesSource(workspaceId, agent)),
  );
  const wanted = new Set(
    desired.map((agent) => `${AGENT_FILES_SOURCE_PREFIX}${workspaceId}:${agent.id}`),
  );
  const existing = await db.workspace_sources
    .where("workspaceId")
    .equals(workspaceId)
    .and((source) => source.kind === "agent")
    .toArray();
  await Promise.all(
    existing
      .filter((source) => !wanted.has(source.id))
      .map((source) => removeSource(source.id)),
  );
}

export async function removeAgentFilesSource(
  workspaceId: string,
  agentId: string,
): Promise<void> {
  await removeSource(`${AGENT_FILES_SOURCE_PREFIX}${workspaceId}:${agentId}`);
}

// A chat's own storage is never moved into a workspace. While the chat is attached, the workspace
// gets one derived `chat` source and a mount at `/chats/<conversationId>`, so its files appear in
// the workspace (and for the agent at that path) without being copied. Detaching removes the
// mount and the source row; the files stay in the chat (workspace/chatStorage.ts).
export { chatStorageSourceId, chatStorageMountPath };

/**
 * Links a chat's own files into a workspace. Idempotent, and it writes nothing when the source and
 * its mount already exist, so the agent can call it on every turn without touching lastModified.
 */
export async function ensureChatStorageSource(
  workspaceId: string,
  conversationId: string,
  label?: string,
): Promise<string> {
  if (!workspaceId || !conversationId) return "";
  const id = chatStorageSourceId(workspaceId, conversationId);
  const text = String(label ?? "").trim() || i18n.t("workspace.kind_chat");
  const mountPath = chatStorageMountPath(conversationId);
  // One transaction: linking a chat and the page's reconcile effect can call
  // this at the same time, and two "create if missing" writes would collide on
  // the deterministic source id.
  return db.transaction(
    "rw",
    [db.workspace_sources, db.workspace_handles, db.workspace_mounts, db.workspaces],
    async () => {
      const existing = await db.workspace_sources.get(id);
      if (!existing) {
        await addSource({
          id,
          workspaceId,
          kind: "chat",
          label: text,
          config: { conversationId },
          status: "offline",
        });
      } else if (existing.label !== text) {
        await updateSource(id, { label: text });
      }
      const mount = await db.workspace_mounts
        .where("workspaceId")
        .equals(workspaceId)
        .and((row) => row.sourceId === id)
        .first();
      if (mount) {
        if (mount.path !== mountPath || mount.sourcePath !== "/") {
          await db.workspace_mounts.update(mount.id, {
            path: mountPath,
            sourcePath: "/",
            lastModified: now(),
          });
        }
      } else {
        await addWorkspaceMount({
          workspaceId,
          sourceId: id,
          sourcePath: "/",
          path: mountPath,
        });
      }
      return id;
    },
  );
}

export async function removeChatStorageSource(
  workspaceId: string,
  conversationId: string,
): Promise<void> {
  await removeSource(chatStorageSourceId(workspaceId, conversationId));
}

/**
 * Reconcile the chat sources of a workspace with its chat links: create what is missing (labels
 * follow the chat titles) and drop what no chat links any more.
 */
export async function syncChatStorageSources(
  workspaceId: string,
  chats: { id: string; title?: string }[],
): Promise<void> {
  if (!workspaceId) return;
  const links = await db.workspace_chats
    .where("workspaceId")
    .equals(workspaceId)
    .toArray();
  const titles = new Map((chats || []).map((chat) => [chat.id, chat.title]));
  await Promise.all(
    links.map((link) =>
      ensureChatStorageSource(
        workspaceId,
        link.conversationId,
        titles.get(link.conversationId),
      ),
    ),
  );
  const wanted = new Set(
    links.map((link) => chatStorageSourceId(workspaceId, link.conversationId)),
  );
  const existing = await db.workspace_sources
    .where("workspaceId")
    .equals(workspaceId)
    .and((source) => source.kind === "chat")
    .toArray();
  await Promise.all(
    existing
      .filter((source) => !wanted.has(source.id))
      .map((source) => removeSource(source.id)),
  );
}

/** Every workspace gets the Arcana Tools filesystem unless the Arcanas module is off. */
export async function ensureArcanaFilesystemSource(
  workspaceId: string,
): Promise<string | undefined> {
  if (!isArcanasEnabled()) return undefined;
  const existing = await db.workspace_sources
    .where("[workspaceId+kind]")
    .equals([workspaceId, "arcana-filesystem"])
    .first();
  if (existing) return existing.id;
  return addSource({
    workspaceId,
    kind: "arcana-filesystem",
    label: i18n.t("workspace.kind_arcana-filesystem"),
    config: {},
    status: "offline",
  });
}


export async function getWorkspace(id: string): Promise<WorkspaceRow | undefined> {
  return id ? db.workspaces.get(id) : undefined;
}

export async function updateWorkspace(
  id: string,
  patch: Partial<Pick<WorkspaceRow, "name" | "icon" | "color" | "pinned">>,
): Promise<void> {
  const trimmed = patch.name?.trim();
  if (patch.name !== undefined && !trimmed) {
    throw new Error("Workspace name is required");
  }
  if (trimmed) {
    const existing = await db.workspaces.toArray();
    if (
      existing.some(
        (workspace) =>
          workspace.id !== id &&
          workspace.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      throw new Error("A workspace with this name already exists");
    }
  }
  const patchRow = {
    ...(trimmed ? { name: trimmed } : {}),
    ...(patch.icon ? { icon: patch.icon } : {}),
    ...(patch.color ? { color: patch.color } : {}),
    ...(typeof patch.pinned === "boolean" ? { pinned: patch.pinned } : {}),
    lastModified: now(),
  };
  await db.workspaces.update(id, patchRow);
}

/** Pin or unpin a workspace; it moves between the pinned section and the workspace list. */
export async function setWorkspacePinned(
  id: string,
  pinned: boolean,
): Promise<void> {
  await updateWorkspace(id, { pinned });
}

export async function deleteWorkspace(id: string): Promise<void> {
  const sources = await db.workspace_sources
    .where("workspaceId")
    .equals(id)
    .toArray();
  await db.transaction(
    "rw",
    [
      db.workspaces,
      db.workspace_sources,
      db.workspace_handles,
      db.workspace_transfers,
      db.workspace_mounts,
      db.workspace_chats,
      db.workspace_agents,
      db.workspace_agent_sessions,
    ],
    async () => {
      await db.workspace_transfers.where("workspaceId").equals(id).delete();
      await db.workspace_mounts.where("workspaceId").equals(id).delete();
      await db.workspace_chats.where("workspaceId").equals(id).delete();
      await db.workspace_agents.where("workspaceId").equals(id).delete();
      await db.workspace_agent_sessions.where("workspaceId").equals(id).delete();
      await db.workspace_sources.where("workspaceId").equals(id).delete();
      await db.workspaces.delete(id);
    },
  );
  for (const source of sources) {
    await db.workspace_handles.delete(source.id);
  }
  // The root and every browser source of the workspace share one tree, so it is
  // cleaned up once. Files a chat still references stay for that chat.
  await deleteUnreferencedSourceNodes(workspaceBrowserStorageId(id));
}

export async function listWorkspaceSummaries() {
  const [workspaces, agents, chats, sources] = await Promise.all([
    db.workspaces.toArray(),
    db.workspace_agents.toArray(),
    db.workspace_chats.toArray(),
    db.workspace_sources.toArray(),
  ]);
  return workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    icon: workspace.icon,
    color: workspace.color,
    pinned: workspace.pinned === true,
    createdAt: workspace.createdAt,
    lastModified: workspace.lastModified,
    agentIds: agents
      .filter((link) => link.workspaceId === workspace.id)
      .map((link) => link.agentId),
    conversationIds: chats
      .filter((link) => link.workspaceId === workspace.id)
      .map((link) => link.conversationId),
    sourceCount: sources.filter((source) => source.workspaceId === workspace.id)
      .length,
  }));
}

// Same snapshot default as `useConversationList`: every page mounts its own
// sidebar, and an empty default empties the workspace section for the first
// frames of a page swap.
let workspaceListSnapshot: WorkspaceRow[] = [];

export function useWorkspaceList(): WorkspaceRow[] {
  const workspaces =
    useLiveQuery(
      () => db.workspaces.orderBy("lastModified").reverse().toArray(),
      [],
      workspaceListSnapshot,
    ) ?? [];
  workspaceListSnapshot = workspaces;
  return workspaces;
}

export function useWorkspace(id?: string): WorkspaceRow | undefined {
  return useLiveQuery(
    () => (id ? db.workspaces.get(id) : undefined),
    [id],
  );
}

export function useWorkspaceSources(workspaceId?: string): WorkspaceSourceRow[] {
  return (
    useLiveQuery(
      () =>
        workspaceId
          ? db.workspace_sources.where("workspaceId").equals(workspaceId).toArray()
          : [],
      [workspaceId],
      [] as WorkspaceSourceRow[],
    ) ?? []
  );
}

const localFolderName = (source: WorkspaceSourceRow): string => {
  const named = (source.config as { folderName?: unknown } | undefined)
    ?.folderName;
  const name = typeof named === "string" ? named.trim() : "";
  return name || source.label;
};

const sameLocalFolder = async (
  left: WorkspaceSourceRow,
  right: WorkspaceSourceRow,
  handles: Map<string, FileSystemDirectoryHandle | undefined>,
): Promise<boolean> => {
  if (left.id === right.id) return true;
  if (localFolderName(left) !== localFolderName(right)) return false;
  const leftHandle = handles.get(left.id);
  const rightHandle = handles.get(right.id);
  if (!leftHandle || !rightHandle) return true;
  if (!leftHandle.isSameEntry) return true;
  try {
    return await leftHandle.isSameEntry(rightHandle);
  } catch {
    return false;
  }
};

/**
 * One row per local folder: the same folder mounted in several workspaces is one
 * entry, while two different folders that happen to share a name stay apart.
 */
export async function distinctLocalSources(
  rows: WorkspaceSourceRow[],
  preferredWorkspaceId?: string,
): Promise<WorkspaceSourceRow[]> {
  const handles = new Map<string, FileSystemDirectoryHandle | undefined>();
  for (const row of rows) handles.set(row.id, await getSourceHandle(row.id));
  return groupLocalSources(rows, handles, preferredWorkspaceId);
}

/** The dedupe step of `distinctLocalSources`, with the handles already loaded. */
export async function groupLocalSources(
  rows: WorkspaceSourceRow[],
  handles: Map<string, FileSystemDirectoryHandle | undefined>,
  preferredWorkspaceId?: string,
): Promise<WorkspaceSourceRow[]> {
  const ordered = [...rows].sort((left, right) => {
    const leftPreferred = left.workspaceId === preferredWorkspaceId ? 1 : 0;
    const rightPreferred = right.workspaceId === preferredWorkspaceId ? 1 : 0;
    if (leftPreferred !== rightPreferred) return rightPreferred - leftPreferred;
    return right.lastModified - left.lastModified;
  });
  const distinct: WorkspaceSourceRow[] = [];
  for (const row of ordered) {
    let duplicate = false;
    for (const kept of distinct) {
      if (await sameLocalFolder(kept, row, handles)) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) distinct.push(row);
  }
  return distinct;
}

/** Every local folder this browser has been granted, across all workspaces. */
export async function listDeviceLocalSources(): Promise<WorkspaceSourceRow[]> {
  const rows = await db.workspace_sources
    .where("kind")
    .equals("local")
    .toArray();
  const deviceId = getDeviceId();
  return rows.filter((row) => !row.deviceId || row.deviceId === deviceId);
}

/**
 * Forget a device folder everywhere: the row in every workspace that points at
 * the same folder, its stored permission and every mount of it. The folder stays
 * on disk; Chat AI simply stops holding it, and it leaves the device list.
 */
export async function unmountLocalFolder(sourceId: string): Promise<void> {
  const source = await db.workspace_sources.get(sourceId);
  if (!source) return;
  if (source.kind !== "local") {
    await removeSource(sourceId);
    return;
  }
  const rows = await db.workspace_sources.where("kind").equals("local").toArray();
  const handles = new Map<string, FileSystemDirectoryHandle | undefined>();
  for (const row of rows) handles.set(row.id, await getSourceHandle(row.id));
  for (const row of rows) {
    if (row.id === sourceId || (await sameLocalFolder(source, row, handles))) {
      await removeSource(row.id);
    }
  }
}

/**
 * Gives the workspace its own source row for a local folder that was mounted
 * elsewhere, reusing the row when the folder is already there.
 */
export async function adoptLocalSource(
  workspaceId: string,
  sourceId: string,
): Promise<string> {
  const source = await db.workspace_sources.get(sourceId);
  if (!source) throw new Error(`Source not found: ${sourceId}`);
  if (source.workspaceId === workspaceId) return source.id;
  if (source.kind !== "local") return source.id;
  const siblings = await db.workspace_sources
    .where("workspaceId")
    .equals(workspaceId)
    .toArray();
  const handle = await getSourceHandle(sourceId);
  for (const sibling of siblings) {
    if (sibling.kind !== "local") continue;
    const handles = new Map([
      [sibling.id, await getSourceHandle(sibling.id)],
      [source.id, handle],
    ]);
    if (await sameLocalFolder(sibling, source, handles)) return sibling.id;
  }
  return addSource({
    workspaceId,
    kind: "local",
    label: source.label,
    config: {
      ...(source.config as Record<string, unknown>),
    } as WorkspaceSourceRow["config"],
    capabilities: source.capabilities,
    readOnly: source.readOnly === true,
    status: "offline",
    handle: handle ?? undefined,
  });
}

/**
 * The device-wide folder list for the storage rail: every folder ever mounted on
 * this device, one row per folder, favouring the caller's own workspace.
 */
export function useDeviceLocalSources(
  preferredWorkspaceId?: string,
): WorkspaceSourceRow[] {
  const rows =
    useLiveQuery(
      () => db.workspace_sources.where("kind").equals("local").toArray(),
      [],
      [] as WorkspaceSourceRow[],
    ) ?? [];
  const [distinct, setDistinct] = useState<WorkspaceSourceRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    const deviceId = getDeviceId();
    const mine = rows.filter((row) => !row.deviceId || row.deviceId === deviceId);
    void distinctLocalSources(mine, preferredWorkspaceId).then((list) => {
      if (!cancelled) setDistinct(list);
    });
    return () => {
      cancelled = true;
    };
  }, [rows, preferredWorkspaceId]);
  return distinct;
}

export type AddSourceInput = {
  id?: string;
  workspaceId: string;
  kind: SourceKind;
  label: string;
  config: WorkspaceSourceRow["config"];
  capabilities?: WorkspaceSourceRow["capabilities"];
  readOnly?: boolean;
  status?: WorkspaceSourceRow["status"];
  handle?: FileSystemDirectoryHandle;
};

export async function addSource(input: AddSourceInput): Promise<string> {
  const id = input.id ?? newId();
  const devicePlane = DEVICE_PLANE_KINDS.has(input.kind);
  const source: WorkspaceSourceRow = {
    id,
    workspaceId: input.workspaceId,
    kind: input.kind,
    label: input.label.trim() || input.kind,
    ...(devicePlane ? { deviceId: getDeviceId() } : {}),
    config: input.config,
    capabilities: input.capabilities ?? defaultCapabilities(input.kind),
    readOnly: input.readOnly === true,
    status: input.status ?? "offline",
    createdAt: now(),
    lastModified: now(),
  };
  // Write the folder handle before the source row, in one transaction: a live query connects a
  // provider as soon as the source exists, and a local provider without its handle would report
  // a missing folder before the handle write finishes.
  await db.transaction("rw", db.workspace_sources, db.workspace_handles, async () => {
    if (input.handle) await saveSourceHandle(id, input.handle);
    await db.workspace_sources.add(source);
  });
  await db.workspaces.update(input.workspaceId, { lastModified: now() });
  return id;
}

export async function updateSource(
  id: string,
  patch: Partial<
    Pick<
      WorkspaceSourceRow,
      "label" | "config" | "capabilities" | "readOnly" | "status" | "error"
    >
  >,
): Promise<void> {
  const nextPatch = { ...patch, lastModified: now() };
  await db.workspace_sources.update(id, nextPatch);
}

export async function removeSource(id: string): Promise<void> {
  const source = await db.workspace_sources.get(id);
  if (!source) return;
  await db.workspace_sources.delete(id);
  await db.workspace_handles.delete(id);
  await db.workspace_mounts.where("sourceId").equals(id).delete();
  // A browser source shares the workspace's tree with its root and its other
  // browser sources, so removing the source only drops the row, not the files.
}

export async function saveSourceHandle(
  sourceId: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  await db.workspace_handles.put({ sourceId, handle });
}

export async function getSourceHandle(
  sourceId: string,
): Promise<FileSystemDirectoryHandle | undefined> {
  const row = await db.workspace_handles.get(sourceId);
  return row?.handle;
}

export async function deleteSourceHandle(sourceId: string): Promise<void> {
  await db.workspace_handles.delete(sourceId);
}

export async function listTransfers(workspaceId: string): Promise<TransferJobRow[]> {
  return db.workspace_transfers.where("workspaceId").equals(workspaceId).toArray();
}

export async function saveTransfer(job: TransferJobRow): Promise<void> {
  await db.workspace_transfers.put({ ...job, updatedAt: now() });
}

export async function deleteTransfer(id: string): Promise<void> {
  await db.workspace_transfers.delete(id);
}

export async function clearFinishedTransfers(workspaceId: string): Promise<void> {
  await db.workspace_transfers
    .where("workspaceId")
    .equals(workspaceId)
    .and((job) => job.status === "done" || job.status === "failed" || job.status === "cancelled")
    .delete();
}

export function usePendingTransfers(workspaceId?: string): TransferJobRow[] {
  return (
    useLiveQuery(
      () =>
        workspaceId
          ? db.workspace_transfers
              .where("workspaceId")
              .equals(workspaceId)
              .and(
                (job) =>
                  job.status === "queued" ||
                  job.status === "running" ||
                  job.status === "failed",
              )
              .toArray()
          : [],
      [workspaceId],
      [] as TransferJobRow[],
    ) ?? []
  );
}

export async function addWorkspaceMount(input: {
  workspaceId: string;
  sourceId: string;
  sourcePath: string;
  path: string;
  readOnly?: boolean;
}): Promise<string> {
  const id = newId();
  const mount: WorkspaceMountRow = {
    id,
    workspaceId: input.workspaceId,
    sourceId: input.sourceId,
    sourcePath: input.sourcePath,
    path: input.path,
    readOnly: input.readOnly === true,
    createdAt: now(),
    lastModified: now(),
  };
  await db.workspace_mounts.add(mount);
  return id;
}

export async function setWorkspaceMountReadOnly(
  mountId: string,
  readOnly: boolean,
): Promise<void> {
  await db.workspace_mounts.update(mountId, {
    readOnly,
    lastModified: now(),
  });
}

export async function removeWorkspaceMount(
  workspaceId: string,
  mountId: string,
): Promise<void> {
  await db.workspace_mounts.delete(mountId);
}

export function useWorkspaceMounts(workspaceId?: string): WorkspaceMountRow[] {
  return (
    useLiveQuery(
      () =>
        workspaceId
          ? db.workspace_mounts.where("workspaceId").equals(workspaceId).toArray()
          : [],
      [workspaceId],
      [] as WorkspaceMountRow[],
    ) ?? []
  );
}

/** Every mount in the database, across workspaces — for unmounting from the device pane. */
export function useAllWorkspaceMounts(): WorkspaceMountRow[] {
  return (
    useLiveQuery(
      () => db.workspace_mounts.toArray(),
      [],
      [] as WorkspaceMountRow[],
    ) ?? []
  );
}

/** Every chat link in the database, across workspaces. */
export function useAllWorkspaceChats(): WorkspaceChatRow[] {
  return (
    useLiveQuery(
      () => db.workspace_chats.toArray(),
      [],
      [] as WorkspaceChatRow[],
    ) ?? []
  );
}

export async function attachWorkspaceChat(
  workspaceId: string,
  conversationId: string,
): Promise<void> {
  const existing = await db.workspace_chats
    .where("[workspaceId+conversationId]")
    .equals([workspaceId, conversationId])
    .first();
  if (existing) return;
  const link: WorkspaceChatRow = {
    id: newId(),
    workspaceId,
    conversationId,
    createdAt: now(),
  };
  await db.workspace_chats.add(link);
  // The chat keeps its own tree; the workspace only shows it at /chats/<conversationId>.
  const title = (await db.conversations.get(conversationId))?.title;
  await ensureChatStorageSource(workspaceId, conversationId, title);
}

/**
 * Creates a new chat and links it to the workspace in one step. The chat keeps
 * its own storage; attaching adds the `/chats/<id>` mount like any other link.
 */
export async function createAttachedChat(
  workspaceId: string,
  conversation: Parameters<typeof createConversation>[0],
): Promise<string> {
  const id = await createConversation(conversation);
  await attachWorkspaceChat(workspaceId, id);
  return id;
}

export async function detachWorkspaceChat(
  workspaceId: string,
  conversationId: string,
): Promise<void> {
  const link = await db.workspace_chats
    .where("[workspaceId+conversationId]")
    .equals([workspaceId, conversationId])
    .first();
  if (!link) return;
  await db.workspace_chats.delete(link.id);
  // Unlink only: the chat's files stay in its own tree.
  await removeChatStorageSource(workspaceId, conversationId);
}

export function useWorkspaceChats(workspaceId?: string): WorkspaceChatRow[] {
  return (
    useLiveQuery(
      () =>
        workspaceId
          ? db.workspace_chats.where("workspaceId").equals(workspaceId).toArray()
          : [],
      [workspaceId],
      [] as WorkspaceChatRow[],
    ) ?? []
  );
}

export async function getChatWorkspaceId(
  conversationId: string,
): Promise<string | null> {
  if (!conversationId) return null;
  const links = await db.workspace_chats
    .where("conversationId")
    .equals(conversationId)
    .toArray();
  if (!links.length) return null;
  return links.sort((a, b) => a.createdAt - b.createdAt)[0]?.workspaceId ?? null;
}

export function useChatWorkspaces(conversationId?: string): WorkspaceChatRow[] {
  return (
    useLiveQuery(
      () =>
        conversationId
          ? db.workspace_chats.where("conversationId").equals(conversationId).toArray()
          : [],
      [conversationId],
      [] as WorkspaceChatRow[],
    ) ?? []
  );
}

export function useWorkspaceChatLinks(): WorkspaceChatRow[] {
  return (
    useLiveQuery(() => db.workspace_chats.toArray(), [], [] as WorkspaceChatRow[]) ?? []
  );
}

export async function attachWorkspaceAgent(
  workspaceId: string,
  agentId: string,
): Promise<void> {
  const existing = await db.workspace_agents
    .where("[workspaceId+agentId]")
    .equals([workspaceId, agentId])
    .first();
  if (existing) return;
  await db.workspace_agents.add({
    id: newId(),
    workspaceId,
    agentId,
    createdAt: now(),
  });
}

export async function hasWorkspaceAgentLink(
  workspaceId: string,
  agentId: string,
): Promise<boolean> {
  return Boolean(
    await db.workspace_agents
      .where("[workspaceId+agentId]")
      .equals([workspaceId, agentId])
      .first(),
  );
}

export async function hasWorkspaceChatLink(
  workspaceId: string,
  conversationId: string,
): Promise<boolean> {
  return Boolean(
    await db.workspace_chats
      .where("[workspaceId+conversationId]")
      .equals([workspaceId, conversationId])
      .first(),
  );
}

export async function detachWorkspaceAgent(
  workspaceId: string,
  agentId: string,
): Promise<void> {
  const link = await db.workspace_agents
    .where("[workspaceId+agentId]")
    .equals([workspaceId, agentId])
    .first();
  if (link) await db.workspace_agents.delete(link.id);
  await db.workspace_agent_sessions
    .where("[workspaceId+agentId]")
    .equals([workspaceId, agentId])
    .delete();
}

export function useWorkspaceAgents(workspaceId?: string): WorkspaceAgentRow[] {
  return (
    useLiveQuery(
      () =>
        workspaceId
          ? db.workspace_agents.where("workspaceId").equals(workspaceId).toArray()
          : [],
      [workspaceId],
      [] as WorkspaceAgentRow[],
    ) ?? []
  );
}

export async function getConversationWorkspaceIds(
  conversationId: string,
): Promise<string[]> {
  if (!conversationId) return [];
  const links = await db.workspace_chats
    .where("conversationId")
    .equals(conversationId)
    .toArray();
  return [...new Set(links.map((link) => link.workspaceId))];
}

/** Workspace rows by id, for callers that only have the chat's workspace links. */
export async function listWorkspacesByIds(
  workspaceIds: string[],
): Promise<WorkspaceRow[]> {
  if (!workspaceIds.length) return [];
  return db.workspaces.where("id").anyOf(workspaceIds).toArray();
}

/** Every source of the given workspaces, mounted or not. */
export async function listWorkspaceSources(
  workspaceIds: string[],
): Promise<WorkspaceSourceRow[]> {
  if (!workspaceIds.length) return [];
  return db.workspace_sources
    .where("workspaceId")
    .anyOf(workspaceIds)
    .toArray();
}

/** Every mount of the given workspaces, in `path` order. */
export async function listWorkspaceMounts(
  workspaceIds: string[],
): Promise<WorkspaceMountRow[]> {
  if (!workspaceIds.length) return [];
  const mounts = await db.workspace_mounts
    .where("workspaceId")
    .anyOf(workspaceIds)
    .toArray();
  return mounts.sort(
    (left, right) =>
      left.path.length - right.path.length || left.path.localeCompare(right.path),
  );
}

export async function getWorkspaceAgentIds(
  workspaceIds: string[],
): Promise<string[]> {
  if (!workspaceIds.length) return [];
  const links = await db.workspace_agents
    .where("workspaceId")
    .anyOf(workspaceIds)
    .toArray();
  return [...new Set(links.map((link) => link.agentId))];
}

export async function getWorkspaceAgentLinks(
  workspaceIds: string[],
): Promise<WorkspaceAgentRow[]> {
  if (!workspaceIds.length) return [];
  return db.workspace_agents
    .where("workspaceId")
    .anyOf(workspaceIds)
    .toArray();
}

export function useWorkspaceAgentLinks(): WorkspaceAgentRow[] {
  return (
    useLiveQuery(
      () => db.workspace_agents.toArray(),
      [],
      [] as WorkspaceAgentRow[],
    ) ?? []
  );
}

export function useAgentWorkspaceLinks(agentId?: string): WorkspaceAgentRow[] {
  return (
    useLiveQuery(
      () =>
        agentId
          ? db.workspace_agents.where("agentId").equals(agentId).toArray()
          : [],
      [agentId],
      [] as WorkspaceAgentRow[],
    ) ?? []
  );
}

/**
 * Drop every workspace link of one agent. Removing an agent deletes it here instead of
 * waiting for a workspace page to notice the orphan, so its sessions leave the
 * workspaces immediately, wherever the agent was removed.
 */
export async function removeWorkspaceAgentLinks(agentId: string): Promise<void> {
  if (!agentId) return;
  await db.workspace_agents.where("agentId").equals(agentId).delete();
  await db.workspace_agent_sessions.where("agentId").equals(agentId).delete();
}

export async function removeOrphanWorkspaceAgents(
  agentIds: Iterable<string>,
): Promise<void> {
  const known = new Set(agentIds);
  const links = await db.workspace_agents.toArray();
  const orphans = links.filter((link) => !known.has(link.agentId));
  if (orphans.length) {
    await db.workspace_agents.bulkDelete(orphans.map((link) => link.id));
  }
  const sessionLinks = await db.workspace_agent_sessions.toArray();
  const orphanSessions = sessionLinks.filter((link) => !known.has(link.agentId));
  if (orphanSessions.length) {
    await db.workspace_agent_sessions.bulkDelete(
      orphanSessions.map((link) => link.id),
    );
  }
}

// ---------- Workspace agent sessions ----------
// A workspace shows only the sessions that are explicitly attached to it, not every
// session of the agent. The link is (workspace, agent, session) because two workspaces
// can show different sessions of the same agent.

export async function attachWorkspaceAgentSession(
  workspaceId: string,
  agentId: string,
  sessionId: string,
): Promise<void> {
  if (!workspaceId || !agentId || !sessionId) return;
  const existing = await db.workspace_agent_sessions
    .where("[workspaceId+agentId+sessionId]")
    .equals([workspaceId, agentId, sessionId])
    .first();
  if (existing) return;
  const link: WorkspaceAgentSessionRow = {
    id: newId(),
    workspaceId,
    agentId,
    sessionId,
    createdAt: now(),
  };
  await db.workspace_agent_sessions.add(link);
}

export async function detachWorkspaceAgentSession(
  workspaceId: string,
  agentId: string,
  sessionId: string,
): Promise<void> {
  await db.workspace_agent_sessions
    .where("[workspaceId+agentId+sessionId]")
    .equals([workspaceId, agentId, sessionId])
    .delete();
}

export async function hasWorkspaceAgentSessionLink(
  workspaceId: string,
  agentId: string,
  sessionId: string,
): Promise<boolean> {
  return Boolean(
    await db.workspace_agent_sessions
      .where("[workspaceId+agentId+sessionId]")
      .equals([workspaceId, agentId, sessionId])
      .first(),
  );
}

export function useWorkspaceAgentSessions(
  workspaceId?: string,
): WorkspaceAgentSessionRow[] {
  return (
    useLiveQuery(
      () =>
        workspaceId
          ? db.workspace_agent_sessions
              .where("workspaceId")
              .equals(workspaceId)
              .toArray()
          : [],
      [workspaceId],
      [] as WorkspaceAgentSessionRow[],
    ) ?? []
  );
}

export function useWorkspaceAgentSessionLinks(): WorkspaceAgentSessionRow[] {
  return (
    useLiveQuery(
      () => db.workspace_agent_sessions.toArray(),
      [],
      [] as WorkspaceAgentSessionRow[],
    ) ?? []
  );
}

export async function getWorkspaceAgentSessionIds(
  workspaceId: string,
  agentId: string,
): Promise<string[]> {
  if (!workspaceId || !agentId) return [];
  const links = await db.workspace_agent_sessions
    .where("[workspaceId+agentId]")
    .equals([workspaceId, agentId])
    .toArray();
  return links.map((link) => link.sessionId);
}

/**
 * Copy the agent's currently active session into a workspace the first time that agent is
 * shown there. Existing workspaces keep working after the upgrade without every old
 * session appearing everywhere.
 */
export async function seedWorkspaceAgentSessions(
  workspaceId: string,
  agents: { id: string; sessionId?: string }[],
): Promise<void> {
  if (!workspaceId) return;
  const links = await db.workspace_agents
    .where("workspaceId")
    .equals(workspaceId)
    .toArray();
  for (const link of links) {
    if (link.sessionsSeeded) continue;
    const agent = agents.find((item) => item.id === link.agentId);
    if (!agent) continue;
    if (agent.sessionId) {
      await attachWorkspaceAgentSession(
        workspaceId,
        link.agentId,
        agent.sessionId,
      );
    }
    await db.workspace_agents.update(link.id, { sessionsSeeded: true });
  }
}

/** Drop the links of a session that was closed on the agent server. */
export async function removeWorkspaceAgentSessionLinks(
  agentId: string,
  sessionId: string,
): Promise<void> {
  if (!agentId || !sessionId) return;
  await db.workspace_agent_sessions
    .where("sessionId")
    .equals(sessionId)
    .and((link) => link.agentId === agentId)
    .delete();
}

/**
 * Move a workspace's session link to a replacement session. Used when a cached session is
 * restored under a new server id, so the workspace keeps showing it.
 */
export async function renameWorkspaceAgentSession(
  agentId: string,
  fromSessionId: string,
  toSessionId: string,
): Promise<void> {
  if (!agentId || !fromSessionId || !toSessionId) return;
  if (fromSessionId === toSessionId) return;
  const links = await db.workspace_agent_sessions
    .where("sessionId")
    .equals(fromSessionId)
    .and((link) => link.agentId === agentId)
    .toArray();
  for (const link of links) {
    await attachWorkspaceAgentSession(
      link.workspaceId,
      agentId,
      toSessionId,
    );
    await db.workspace_agent_sessions.delete(link.id);
  }
}
