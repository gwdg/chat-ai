import { useLiveQuery } from "dexie-react-hooks";

import { db, newId } from "./index";
import type {
  SourceKind,
  WorkspaceRow,
  WorkspaceSourceRow,
  TransferJobRow,
  WorkspaceMountRow,
  WorkspaceChatRow,
} from "./dbTypes";
import { defaultCapabilities } from "../workspace/capabilities";
import { getDeviceId, DEVICE_PLANE_KINDS } from "../workspace/deviceId";
import { deleteSourceNodes } from "./workspaceVfs";


export { getDeviceId } from "../workspace/deviceId";

const now = () => Date.now();

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
    createdAt: now(),
    lastModified: now(),
  };
  await db.workspaces.add(workspace);
  return id;
}


export async function getWorkspace(id: string): Promise<WorkspaceRow | undefined> {
  return id ? db.workspaces.get(id) : undefined;
}

export async function updateWorkspace(
  id: string,
  patch: Partial<Pick<WorkspaceRow, "name">>,
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
    ],
    async () => {
      await db.workspace_transfers.where("workspaceId").equals(id).delete();
      await db.workspace_mounts.where("workspaceId").equals(id).delete();
      await db.workspace_chats.where("workspaceId").equals(id).delete();
      await db.workspace_sources.where("workspaceId").equals(id).delete();
      await db.workspaces.delete(id);
    },
  );
  for (const source of sources) {
    await db.workspace_handles.delete(source.id);
    if (source.kind === "browser") await deleteSourceNodes(source.id);
  }
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
