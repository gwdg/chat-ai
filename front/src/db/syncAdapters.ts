import { db } from "./index";
import type {
  FolderRow,
  WorkspaceAgentRow,
  WorkspaceAgentSessionRow,
  WorkspaceChatRow,
  WorkspaceMountRow,
  WorkspaceRow,
  WorkspaceSourceRow,
} from "./dbTypes";
import { workspaceBrowserStorageId } from "../workspace/browserStorage";
import { deleteWorkspace } from "./workspaceDb";
import { saveAgentSessionMessages, saveAgentSessions } from "./agentSessionCache";

/**
 * Local writes for the sync namespaces.
 *
 * Raw Dexie tables are only touched here (AGENTS.md §4.2): the sync module calls
 * these functions instead of importing `db`. Everything is a `put` of a value
 * that came out of another device, so no app-level bookkeeping (timestamps of
 * the current user, `lastOpenedAt`, ...) is invented beyond what is missing.
 */

export async function upsertFolder(payload: any): Promise<void> {
  if (!payload?.id || !payload?.name) return;
  const existing = await db.folders.get(payload.id);
  const row: FolderRow = {
    id: String(payload.id),
    name: String(payload.name),
    // The record is authoritative. Keeping a different local creation time
    // would make every later `list()` hash differently and re-push the topic.
    createdAt:
      Number(payload.createdAt) || existing?.createdAt || Date.now(),
    updatedAt: Number(payload.updatedAt) || Date.now(),
    ...(payload.icon ? { icon: String(payload.icon) } : {}),
    ...(payload.color ? { color: String(payload.color) } : {}),
    ...(payload.pinned === true ? { pinned: true } : {}),
    ...(Number.isFinite(payload.sortOrder) ? { sortOrder: payload.sortOrder } : {}),
  } as FolderRow;
  await db.folders.put(row);
}

export type WorkspaceTreeEntryForSync = {
  path: string;
  kind: "file" | "dir";
  mime?: string;
  size?: number;
  nodeId?: string;
  /** Present when the entry is applied; never part of the hashed payload. */
  data?: Uint8Array;
};

/**
 * The persona banner of a chat. `updateConversation` does not carry it, so a
 * synced record writes it directly; `null` clears it, like the record says.
 */
export async function setConversationPersonaForSync(
  conversationId: string,
  persona: any,
): Promise<void> {
  if (!conversationId) return;
  if (!(await db.conversations.get(conversationId))) return;
  // `undefined` drops the property, which is what "no persona" means.
  await db.conversations.update(conversationId, {
    persona: persona ?? undefined,
  });
}

export type WorkspaceBundleForSync = {
  workspace: WorkspaceRow;
  sources: WorkspaceSourceRow[];
  mounts: WorkspaceMountRow[];
  chats: WorkspaceChatRow[];
  agents: WorkspaceAgentRow[];
  sessions: WorkspaceAgentSessionRow[];
  tree: WorkspaceTreeEntryForSync[];
};

/** Every workspace with the rows that belong to it and the shape of its own tree. */
export async function listWorkspaceBundlesForSync(): Promise<
  WorkspaceBundleForSync[]
> {
  const workspaces = await db.workspaces.toArray();
  const bundles: WorkspaceBundleForSync[] = [];
  for (const workspace of workspaces) {
    const [sources, mounts, chats, agents, sessions] = await Promise.all([
      db.workspace_sources.where("workspaceId").equals(workspace.id).toArray(),
      db.workspace_mounts.where("workspaceId").equals(workspace.id).toArray(),
      db.workspace_chats.where("workspaceId").equals(workspace.id).toArray(),
      db.workspace_agents.where("workspaceId").equals(workspace.id).toArray(),
      db.workspace_agent_sessions
        .where("workspaceId")
        .equals(workspace.id)
        .toArray(),
    ]);
    const sourceId = workspaceBrowserStorageId(workspace.id);
    const nodes = await db.workspace_nodes
      .where("sourceId")
      .equals(sourceId)
      .toArray();
    bundles.push({
      workspace,
      sources: sources.map((row) => ({ ...row })),
      mounts: mounts.map((row) => ({ ...row })),
      chats: chats.map((row) => ({ ...row })),
      agents: agents.map((row) => ({ ...row })),
      sessions: sessions.map((row) => ({ ...row })),
      tree: nodes.map((node) => ({
        path: node.path,
        kind: node.kind,
        mime: node.mime,
        size: node.size,
        nodeId: node.id,
      })),
    });
  }
  return bundles;
}

export async function readWorkspaceTreeFile(
  workspaceId: string,
  nodeId: string,
): Promise<Uint8Array | null> {
  const sourceId = workspaceBrowserStorageId(workspaceId);
  const row = await db.workspace_blobs.get(nodeId);
  if (!row || row.sourceId !== sourceId) return null;
  return row.data;
}

/**
 * Apply a workspace bundle. `rewrite` renames a conflict copy: the workspace and
 * every link get a new id, and its tree is written into the new workspace's own
 * browser source.
 *
 * The tree is applied additively: files the bundle carries overwrite the same
 * path, but a local file the bundle does not mention is kept. A file that was
 * too large to upload therefore survives a pull instead of being deleted.
 */
export async function applyWorkspaceBundle(
  bundle: WorkspaceBundleForSync,
  rewrite: { workspaceId: string; name: string } | null = null,
): Promise<void> {
  if (!bundle?.workspace?.id) return;
  const workspaceId = rewrite?.workspaceId ?? bundle.workspace.id;
  const now = Date.now();
  const workspace: WorkspaceRow = {
    ...bundle.workspace,
    id: workspaceId,
    name: rewrite?.name ?? bundle.workspace.name,
  };
  await db.workspaces.put(workspace);

  const idOf = (rowId: string) =>
    rewrite ? `${rowId}~${rewrite.workspaceId}` : rowId;

  for (const source of bundle.sources) {
    const id = idOf(source.id);
    const existing = await db.workspace_sources.get(id);
    // Keep this device's provider status: it says whether the source works
    // here, and the record deliberately does not carry the other device's.
    await db.workspace_sources.put({
      ...source,
      id,
      workspaceId,
      status: existing?.status ?? "offline",
      ...(existing?.error ? { error: existing.error } : {}),
    });
  }
  for (const mount of bundle.mounts) {
    await db.workspace_mounts.put({
      ...mount,
      id: idOf(mount.id),
      workspaceId,
      sourceId: idOf(mount.sourceId),
    });
  }
  for (const chat of bundle.chats) {
    await db.workspace_chats.put({
      ...chat,
      id: idOf(chat.id),
      workspaceId,
    });
  }
  for (const link of bundle.agents) {
    await db.workspace_agents.put({
      ...link,
      id: idOf(link.id),
      workspaceId,
    });
  }
  for (const session of bundle.sessions) {
    await db.workspace_agent_sessions.put({
      ...session,
      id: idOf(session.id),
      workspaceId,
    });
  }

  // The tree always lives in the workspace's own browser source, so a rewritten
  // copy does not share storage with the workspace it was copied from.
  const sourceId = workspaceBrowserStorageId(workspaceId);
  const nodeIdOf = (nodeId: string | undefined, path: string) => {
    const base = nodeId ?? `${sourceId}:${path}`;
    return rewrite ? `${base}~${workspaceId}` : base;
  };
  for (const entry of bundle.tree) {
    if (entry.kind === "dir") {
      await db.workspace_nodes.put({
        id: nodeIdOf(entry.nodeId, entry.path),
        sourceId,
        path: entry.path,
        parentPath: parentOf(entry.path),
        name: baseOf(entry.path),
        kind: "dir",
        mtime: new Date(now).toISOString(),
      });
      continue;
    }
    if (!entry.data) continue;
    const nodeId = nodeIdOf(entry.nodeId, entry.path);
    await db.transaction("rw", [db.workspace_nodes, db.workspace_blobs], async () => {
      await db.workspace_nodes.put({
        id: nodeId,
        sourceId,
        path: entry.path,
        parentPath: parentOf(entry.path),
        name: baseOf(entry.path),
        kind: "file",
        size: entry.data!.byteLength,
        mime: entry.mime,
        mtime: new Date(now).toISOString(),
      });
      await db.workspace_blobs.put({ id: nodeId, sourceId, data: entry.data! });
    });
  }
}

const parentOf = (path: string) => {
  const index = path.lastIndexOf("/");
  return index <= 0 ? "/" : path.slice(0, index);
};
const baseOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export async function deleteWorkspaceForSync(id: string): Promise<void> {
  await deleteWorkspace(id);
}

/** Cached OpenCode session metadata and histories of one agent. */
export async function readAgentSessionCacheForSync(agentId: string): Promise<{
  sessions: { sessionId: string; data: any }[];
  histories: { sessionId: string; messages: any[] }[];
}> {
  const rows = await db.agent_sessions.where("agentId").equals(agentId).toArray();
  const sessions = rows
    .filter((row) => row.data)
    .map((row) => ({ sessionId: row.sessionId, data: row.data }));
  const histories: { sessionId: string; messages: any[] }[] = [];
  for (const session of sessions) {
    const messages = await db.agent_session_messages
      .where("[agentId+sessionId]")
      .equals([agentId, session.sessionId])
      .toArray();
    messages.sort((left, right) => left.position - right.position);
    if (messages.length) {
      histories.push({
        sessionId: session.sessionId,
        messages: messages.map((row) => row.data),
      });
    }
  }
  return { sessions, histories };
}

/**
 * Write a synced session cache. The histories replace the local ones: the
 * record carries the whole history, and merging message-by-message would leave
 * trailing messages of a reverted session behind.
 */
export async function writeAgentSessionCacheForSync(
  agentId: string,
  sessions: { sessionId: string; data: any }[],
  histories: { sessionId: string; messages: any[] }[],
): Promise<void> {
  if (!agentId) return;
  const list = sessions
    .filter((session) => session?.sessionId)
    .map((session) => ({ ...session.data, id: session.sessionId }));
  if (list.length) {
    await saveAgentSessions(agentId, list);
  }
  for (const history of histories) {
    if (!history?.sessionId || !Array.isArray(history.messages)) continue;
    await saveAgentSessionMessages(agentId, history.sessionId, history.messages, {
      replace: true,
    });
  }
}
