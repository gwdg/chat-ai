import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'

import { db, newId } from './index'
import type {
  ConversationSettings,
  VfsNodeRow,
  WorkspaceMessageRow,
  WorkspaceRow,
} from './dbTypes'
import {
  baseName,
  isWithinPath,
  joinPath,
  normalizePath,
  parentPath,
} from '../filesystem/paths'

// ---------- Workspaces ----------

export type CreateWorkspaceInput = {
  name: string
  rootPath: string
  modelId: string
  modelName?: string
  skills?: string[]
  settings: ConversationSettings
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<string> {
  const name = input.name?.trim()
  if (!name) throw new Error('Workspace name is required')
  const rootPath = normalizePath(input.rootPath)
  if (rootPath === '/') throw new Error('Choose a folder below the root')

  const existing = await db.workspaces.toArray()
  if (existing.some((workspace) => workspace.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A workspace with this name already exists')
  }

  await ensureFolderTree(rootPath)
  const now = Date.now()
  const id = newId()
  await db.workspaces.add({
    id,
    name,
    rootPath,
    mode: 'local',
    modelId: input.modelId,
    modelName: input.modelName,
    skills: Array.from(new Set(input.skills ?? [])),
    settings: input.settings,
    createdAt: now,
    lastModified: now,
  })
  return id
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceRow | undefined> {
  if (!workspaceId) return undefined
  return db.workspaces.get(workspaceId)
}

export async function listWorkspaces(): Promise<WorkspaceRow[]> {
  const rows = await db.workspaces.orderBy('lastModified').reverse().toArray()
  return rows
}

export async function updateWorkspace(
  workspaceId: string,
  patch: Partial<Omit<WorkspaceRow, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.workspaces.update(workspaceId, {
    ...patch,
    lastModified: Date.now(),
  })
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  patch: Partial<ConversationSettings>,
): Promise<void> {
  const workspace = await db.workspaces.get(workspaceId)
  if (!workspace) return
  await db.workspaces.update(workspaceId, {
    settings: { ...workspace.settings, ...patch },
    lastModified: Date.now(),
  })
}

/**
 * Deletes the workspace and its transcript. The files stay in the VFS because
 * they may be shared with another workspace.
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await db.transaction('rw', [db.workspaces, db.workspace_messages], async () => {
    await db.workspace_messages.where('workspaceId').equals(workspaceId).delete()
    await db.workspaces.delete(workspaceId)
  })
}

export function useWorkspaceList(): WorkspaceRow[] {
  return (
    useLiveQuery(
      async () => db.workspaces.orderBy('lastModified').reverse().toArray(),
      [],
      [] as WorkspaceRow[],
    ) ?? []
  )
}

export function useWorkspace(workspaceId: string): WorkspaceRow | undefined {
  return useLiveQuery(
    async () => (workspaceId ? db.workspaces.get(workspaceId) : undefined),
    [workspaceId],
  )
}

// ---------- Transcript ----------

export async function loadWorkspaceMessages(workspaceId: string): Promise<any[]> {
  if (!workspaceId) return []
  const rows = await db.workspace_messages
    .where('[workspaceId+idx]')
    .between([workspaceId, Dexie.minKey], [workspaceId, Dexie.maxKey])
    .sortBy('idx')
  return rows.map((row) => row.data)
}

export async function replaceWorkspaceMessages(
  workspaceId: string,
  messages: any[],
): Promise<void> {
  if (!workspaceId) return
  const now = Date.now()
  const rows: WorkspaceMessageRow[] = (messages ?? []).map((data, idx) => ({
    id: `${workspaceId}:${idx}`,
    workspaceId,
    idx,
    data,
    createdAt: data?.timestamp ?? now,
  }))
  await db.transaction('rw', db.workspace_messages, async () => {
    await db.workspace_messages.where('workspaceId').equals(workspaceId).delete()
    if (rows.length) await db.workspace_messages.bulkAdd(rows)
  })
}

// ---------- Virtual file system ----------

export async function getVfsNode(path: string): Promise<VfsNodeRow | undefined> {
  return db.vfs_nodes.where('path').equals(normalizePath(path)).first()
}

export async function listVfsChildren(path: string): Promise<VfsNodeRow[]> {
  const rows = await db.vfs_nodes
    .where('parentPath')
    .equals(normalizePath(path))
    .toArray()
  return rows.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

export function useVfsChildren(path: string): VfsNodeRow[] {
  return (
    useLiveQuery(
      async () => listVfsChildren(path),
      [normalizePath(path)],
      [] as VfsNodeRow[],
    ) ?? []
  )
}

export async function ensureFolderTree(path: string): Promise<VfsNodeRow> {
  const normalized = normalizePath(path)
  if (normalized === '/') {
    return {
      id: 'vfs-root',
      path: '/',
      parentPath: '/',
      name: '/',
      type: 'folder',
      createdAt: 0,
      updatedAt: 0,
    }
  }

  return db.transaction('rw', db.vfs_nodes, async () => {
    const existing = await db.vfs_nodes.where('path').equals(normalized).first()
    if (existing) {
      if (existing.type !== 'folder') throw new Error(`"${normalized}" is a file`)
      return existing
    }

    const parent = parentPath(normalized)
    if (parent !== '/') {
      const parentNode = await db.vfs_nodes.where('path').equals(parent).first()
      if (!parentNode) {
        // Create missing ancestors first so a typed path always works.
        await createFolderRows(parent)
      } else if (parentNode.type !== 'folder') {
        throw new Error(`"${parent}" is a file`)
      }
    }

    const now = Date.now()
    const row: VfsNodeRow = {
      id: newId(),
      path: normalized,
      parentPath: parent,
      name: baseName(normalized),
      type: 'folder',
      createdAt: now,
      updatedAt: now,
    }
    await db.vfs_nodes.add(row)
    return row
  })
}

async function createFolderRows(path: string): Promise<void> {
  const normalized = normalizePath(path)
  if (normalized === '/') return
  const existing = await db.vfs_nodes.where('path').equals(normalized).first()
  if (existing) {
    if (existing.type !== 'folder') throw new Error(`"${normalized}" is a file`)
    return
  }
  const parent = parentPath(normalized)
  if (parent !== '/') await createFolderRows(parent)
  const now = Date.now()
  await db.vfs_nodes.add({
    id: newId(),
    path: normalized,
    parentPath: parent,
    name: baseName(normalized),
    type: 'folder',
    createdAt: now,
    updatedAt: now,
  })
}

export async function createVfsFolder(path: string): Promise<VfsNodeRow> {
  return ensureFolderTree(path)
}

export async function writeVfsFile(
  path: string,
  data: Blob | ArrayBuffer | Uint8Array | string,
  mimeType = 'application/octet-stream',
): Promise<VfsNodeRow> {
  const normalized = normalizePath(path)
  if (normalized === '/') throw new Error('Cannot write a file at the VFS root')

  const blob =
    data instanceof Blob
      ? data
      : new Blob([data as BlobPart], { type: mimeType })

  const parent = parentPath(normalized)
  await ensureFolderTree(parent)

  return db.transaction('rw', [db.vfs_nodes, db.vfs_blobs], async () => {
    const existing = await db.vfs_nodes.where('path').equals(normalized).first()
    if (existing?.type === 'folder') throw new Error(`"${normalized}" is a folder`)

    const now = Date.now()
    const row: VfsNodeRow = existing
      ? {
          ...existing,
          size: blob.size,
          mimeType: blob.type || mimeType,
          updatedAt: now,
        }
      : {
          id: newId(),
          path: normalized,
          parentPath: parent,
          name: baseName(normalized),
          type: 'file',
          size: blob.size,
          mimeType: blob.type || mimeType,
          createdAt: now,
          updatedAt: now,
        }

    await db.vfs_nodes.put(row)
    await db.vfs_blobs.put({ id: row.id, blob })
    return row
  })
}

export async function readVfsBlob(path: string): Promise<Blob | null> {
  const node = await getVfsNode(path)
  if (!node || node.type !== 'file') return null
  const row = await db.vfs_blobs.get(node.id)
  return row?.blob ?? null
}

export async function readVfsText(path: string): Promise<string | null> {
  const blob = await readVfsBlob(path)
  if (!blob) return null
  return blob.text()
}

export async function deleteVfsPath(path: string): Promise<void> {
  const normalized = normalizePath(path)
  if (normalized === '/') throw new Error('The VFS root cannot be deleted')

  const targets = await collectPathAndDescendants(normalized)
  if (!targets.length) return

  const workspaces = await db.workspaces.toArray()
  const protectedRoot = workspaces.find((workspace) =>
    targets.some((target) => isWithinPath(target.path, workspace.rootPath)),
  )
  if (protectedRoot) {
    throw new Error(
      `"${protectedRoot.name}" uses a folder inside this path. Remove or move the workspace first.`,
    )
  }

  const ids = targets.map((row) => row.id)
  await db.transaction('rw', [db.vfs_nodes, db.vfs_blobs], async () => {
    await db.vfs_blobs.bulkDelete(ids)
    await db.vfs_nodes.bulkDelete(ids)
  })
}

async function collectPathAndDescendants(path: string): Promise<VfsNodeRow[]> {
  const normalized = normalizePath(path)
  const exact = await db.vfs_nodes.where('path').equals(normalized).first()
  if (!exact) return []
  const descendants = await db.vfs_nodes
    .where('path')
    .startsWith(`${normalized}/`)
    .toArray()
  return [exact, ...descendants]
}

export async function moveVfsPath(fromPath: string, toPath: string): Promise<void> {
  const from = normalizePath(fromPath)
  const to = normalizePath(toPath)
  if (from === '/' || to === '/') throw new Error('The VFS root cannot be moved')
  if (from === to) return
  if (isWithinPath(from, to)) {
    throw new Error('A folder cannot be moved inside itself')
  }

  const source = await db.vfs_nodes.where('path').equals(from).first()
  if (!source) throw new Error(`"${from}" does not exist`)
  const existingTarget = await db.vfs_nodes.where('path').equals(to).first()
  if (existingTarget) throw new Error(`"${to}" already exists`)

  const targetParent = parentPath(to)
  await ensureFolderTree(targetParent)

  const descendants = await db.vfs_nodes
    .where('path')
    .startsWith(`${from}/`)
    .toArray()

  await db.transaction('rw', [db.vfs_nodes, db.workspaces], async () => {
    const now = Date.now()
    for (const node of [source, ...descendants]) {
      const nextPath = node.path === from ? to : joinPath(to, node.path.slice(from.length + 1))
      const nextParent = node.path === from ? targetParent : parentPath(nextPath)
      await db.vfs_nodes.put({
        ...node,
        path: nextPath,
        parentPath: nextParent,
        name: baseName(nextPath),
        updatedAt: now,
      })
    }

    // Keep workspaces valid when a folder containing their root is renamed.
    const workspaces = await db.workspaces.toArray()
    for (const workspace of workspaces) {
      if (!isWithinPath(from, workspace.rootPath)) continue
      const nextRoot =
        workspace.rootPath === from
          ? to
          : joinPath(to, workspace.rootPath.slice(from.length + 1))
      await db.workspaces.update(workspace.id, {
        rootPath: nextRoot,
        lastModified: now,
      })
    }
  })
}

export async function countVfsFilesUnder(path: string): Promise<number> {
  const normalized = normalizePath(path)
  const exact = await db.vfs_nodes.where('path').equals(normalized).first()
  const descendants = await db.vfs_nodes
    .where('path')
    .startsWith(`${normalized}/`)
    .toArray()
  return [exact, ...descendants].filter((node) => node?.type === 'file').length
}
