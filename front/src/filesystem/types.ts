import type { VfsNodeRow } from '../db/dbTypes'

/**
 * The small surface the agent tools and the workspace file browser need.
 *
 * `LocalFileSystem` stores everything in IndexedDB. A future remote provider
 * (HTTP API, WebDAV, S3, ...) only needs to implement the same methods; tools
 * and UI do not need to know where the bytes live.
 */
export interface FileSystemProvider {
  /** Absolute root of this workspace, e.g. "/projects/demo". */
  readonly rootPath: string
  /** Resolve a workspace-relative path to an absolute VFS path. */
  resolvePath(input: string | undefined): string
  /** Convert an absolute VFS path to a workspace-relative one ("." for root). */
  relativePath(absolutePath: string): string

  list(path: string): Promise<VfsNodeRow[]>
  stat(path: string): Promise<VfsNodeRow | null>
  mkdir(path: string): Promise<VfsNodeRow>
  writeFile(
    path: string,
    data: Blob | ArrayBuffer | Uint8Array | string,
    mimeType?: string,
  ): Promise<VfsNodeRow>
  readFile(path: string): Promise<Blob | null>
  readText(path: string): Promise<string | null>
  remove(path: string): Promise<void>
  move(fromPath: string, toPath: string): Promise<void>
}

export type FileSystemEntry = VfsNodeRow
