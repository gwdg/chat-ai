import { useLiveQuery } from "dexie-react-hooks";
import i18n from "../i18n";
import { isArcanasEnabled } from "../utils/modules";

import { db, newId } from "./index";
import type {
  SourceKind,
  WorkspaceRow,
  WorkspaceSourceRow,
  TransferJobRow,
  WorkspaceMountRow,
  WorkspaceChatRow,
  WorkspaceAgentRow,
  WorkspaceFileReferenceRow,
} from "./dbTypes";
import { defaultCapabilities } from "../workspace/capabilities";
import { getDeviceId, DEVICE_PLANE_KINDS } from "../workspace/deviceId";
import { deleteSourceNodes } from "./workspaceVfs";


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

export async function createWorkspace(name: string): Promise<string> {
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
  const workspace: WorkspaceRow = {
    id,
    name: trimmed,
    icon: "rocket",
    createdAt: now(),
    lastModified: now(),
  };
  await db.workspaces.add(workspace);
  await ensureBrowserSource(id);
  await ensureArcanaFilesystemSource(id);
  return id;
}

/** Every workspace gets a browser-storage source; all browser sources share one IndexedDB tree. */
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
    label: i18n.t("workspace.source_browser"),
    config: { storage: "indexeddb" },
    status: "offline",
  });
}

/** Every workspace gets the ArcanaV2 filesystem unless the Arcanas module is off. */
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
  patch: Partial<Pick<WorkspaceRow, "name" | "icon" | "color">>,
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
    lastModified: now(),
  };
  await db.workspaces.update(id, patchRow);
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
    ],
    async () => {
      await db.workspace_transfers.where("workspaceId").equals(id).delete();
      await db.workspace_mounts.where("workspaceId").equals(id).delete();
      await db.workspace_chats.where("workspaceId").equals(id).delete();
      await db.workspace_agents.where("workspaceId").equals(id).delete();
      await db.workspace_sources.where("workspaceId").equals(id).delete();
      await db.workspaces.delete(id);
    },
  );
  for (const source of sources) {
    await db.workspace_handles.delete(source.id);
    if (source.kind === "browser") {
      await deleteUnreferencedSourceNodes(source.id);
    }
  }
  await deleteUnreferencedSourceNodes(`workspace-root:${id}`);
}

export function useWorkspaceList(): WorkspaceRow[] {
  return (
    useLiveQuery(
      () => db.workspaces.orderBy("lastModified").reverse().toArray(),
      [],
      [] as WorkspaceRow[],
    ) ?? []
  );
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
  await db.workspace_sources.add(source);
  if (input.handle) await saveSourceHandle(id, input.handle);
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
  if (source.kind === "browser") await deleteSourceNodes(id);
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

export async function detachWorkspaceAgent(
  workspaceId: string,
  agentId: string,
): Promise<void> {
  const link = await db.workspace_agents
    .where("[workspaceId+agentId]")
    .equals([workspaceId, agentId])
    .first();
  if (link) await db.workspace_agents.delete(link.id);
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

export async function removeOrphanWorkspaceAgents(
  agentIds: Iterable<string>,
): Promise<void> {
  const known = new Set(agentIds);
  const links = await db.workspace_agents.toArray();
  const orphans = links.filter((link) => !known.has(link.agentId));
  if (orphans.length) {
    await db.workspace_agents.bulkDelete(orphans.map((link) => link.id));
  }
}
