import type { VfsNodeRow } from '../db/dbTypes'
import {
  deleteVfsPath,
  getVfsNode,
  listVfsChildren,
  moveVfsPath,
  readVfsBlob,
  readVfsText,
  writeVfsFile,
  createVfsFolder,
} from '../db/workspaceDb'
import {
  isWithinPath,
  normalizePath,
  relativeToRoot,
  resolveWorkspacePath,
} from './paths'
import type { FileSystemProvider } from './types'

/**
 * IndexedDB-backed virtual file system.
 *
 * Paths passed to the public methods can be workspace-relative ("notes/a.md")
 * or absolute VFS paths inside the workspace ("/projects/demo/notes/a.md").
 * Absolute paths outside the workspace are treated as workspace-relative, so
 * an agent can never reach another workspace's files.
 */
export class LocalFileSystem implements FileSystemProvider {
  readonly rootPath: string

  constructor(rootPath: string) {
    this.rootPath = normalizePath(rootPath)
  }

  resolvePath(input?: string): string {
    const value = typeof input === 'string' ? input.trim() : ''
    if (value.startsWith('/')) {
      const absolute = normalizePath(value)
      if (isWithinPath(this.rootPath, absolute)) return absolute
    }
    return resolveWorkspacePath(this.rootPath, value, '.')
  }

  relativePath(absolutePath: string): string {
    return relativeToRoot(this.rootPath, normalizePath(absolutePath))
  }

  async list(path?: string): Promise<VfsNodeRow[]> {
    const target = this.resolvePath(path)
    const node = await getVfsNode(target)
    if (node && node.type !== 'folder') {
      throw new Error(`"${target}" is a file`)
    }
    return listVfsChildren(target)
  }

  async stat(path?: string): Promise<VfsNodeRow | null> {
    return (await getVfsNode(this.resolvePath(path))) ?? null
  }

  async mkdir(path: string): Promise<VfsNodeRow> {
    return createVfsFolder(this.resolvePath(path))
  }

  async writeFile(
    path: string,
    data: Blob | ArrayBuffer | Uint8Array | string,
    mimeType = 'text/plain',
  ): Promise<VfsNodeRow> {
    return writeVfsFile(this.resolvePath(path), data, mimeType)
  }

  async readFile(path: string): Promise<Blob | null> {
    return readVfsBlob(this.resolvePath(path))
  }

  async readText(path: string): Promise<string | null> {
    return readVfsText(this.resolvePath(path))
  }

  async remove(path: string): Promise<void> {
    const target = this.resolvePath(path)
    if (target === this.rootPath) {
      throw new Error('The workspace root cannot be deleted')
    }
    await deleteVfsPath(target)
  }

  async move(fromPath: string, toPath: string): Promise<void> {
    const from = this.resolvePath(fromPath)
    const to = this.resolvePath(toPath)
    if (from === this.rootPath) {
      throw new Error('The workspace root cannot be moved')
    }
    await moveVfsPath(from, to)
  }
}
