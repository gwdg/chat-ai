import { LocalFileSystem } from './local'
import type { FileSystemProvider } from './types'
import type { WorkspaceRow } from '../db/dbTypes'

export type { FileSystemProvider, FileSystemEntry } from './types'
export { LocalFileSystem } from './local'
export * from './paths'

/**
 * Single switch point for the storage backend. Remote workspaces will return a
 * provider that talks to their API but exposes the same interface.
 */
export function createFileSystem(workspace: Pick<WorkspaceRow, 'mode' | 'rootPath'>): FileSystemProvider {
  if (workspace.mode === 'local') {
    return new LocalFileSystem(workspace.rootPath)
  }
  throw new Error(`Unsupported workspace mode: ${(workspace as any).mode}`)
}
