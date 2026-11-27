import { readAll, streamOf } from "../../bytes";
import { baseName, normalizePath, parentPath } from "../../paths";
import type { DirectoryPage, FileProvider } from "../../providers/types";
import { WorkspaceError } from "../../providers/types";

export type MemoryNode = {
  kind: "file" | "dir";
  data?: Uint8Array;
  mtime: string;
};

/** Two entries per page, so a caller that ignores `next` loses files. */
const PAGE_SIZE = 2;

/**
 * A paged, in-memory workspace source. Git calls `readdir` on directories with
 * hundreds of `.git` entries and has to see all of them.
 */
export const createMemoryProvider = (
  root = "/",
): FileProvider & { files: Map<string, MemoryNode> } => {
  const files = new Map<string, MemoryNode>();
  const stamp = () => new Date().toISOString();

  const ensureDir = (path: string) => {
    const normalized = normalizePath(path);
    if (normalized === "/") return;
    if (!files.has(normalized)) {
      ensureDir(parentPath(normalized));
      files.set(normalized, { kind: "dir", mtime: stamp() });
    }
  };

  const childrenOf = (parent: string) =>
    [...files.entries()]
      .filter(
        ([entryPath]) =>
          entryPath !== "/" && parentPath(entryPath) === parent,
      )
      .map(([entryPath, entry]) => ({ entryPath, entry }));

  const provider = {
    sourceId: "test",
    kind: "browser" as const,
    capabilities: {
      read: true,
      write: true,
      delete: true,
      mkdir: true,
    } as FileProvider["capabilities"],
    status: "connected" as const,
    files,
    async connect() {},
    async list(path, cursor): Promise<DirectoryPage> {
      const normalized = normalizePath(path);
      const node = files.get(normalized);
      if (!node) throw new WorkspaceError("NOT_FOUND", normalized);
      if (node.kind !== "dir") throw new WorkspaceError("NOT_FOUND", normalized);
      const start = cursor ? Number(cursor) : 0;
      const page = childrenOf(normalized).slice(start, start + PAGE_SIZE);
      return {
        entries: page.map(({ entryPath, entry }) => ({
          sourceId: "test",
          path: entryPath,
          name: baseName(entryPath),
          kind: entry.kind,
          size: entry.data?.byteLength ?? 0,
          mtime: entry.mtime,
        })),
        next:
          start + page.length < childrenOf(normalized).length
            ? String(start + page.length)
            : undefined,
      };
    },
    async stat(path: string) {
      const normalized = normalizePath(path);
      const node = files.get(normalized);
      if (!node) throw new WorkspaceError("NOT_FOUND", normalized);
      return {
        sourceId: "test",
        path: normalized,
        name: baseName(normalized) || "/",
        kind: node.kind,
        size: node.data?.byteLength ?? 0,
        mtime: node.mtime,
      };
    },
    async read(path: string) {
      const normalized = normalizePath(path);
      const node = files.get(normalized);
      if (!node || node.kind !== "file") {
        throw new WorkspaceError("NOT_FOUND", normalized);
      }
      return streamOf(node.data ?? new Uint8Array());
    },
    async write(
      path: string,
      data: ReadableStream<Uint8Array>,
      _opts: { size?: number; overwrite: boolean },
    ) {
      const normalized = normalizePath(path);
      ensureDir(parentPath(normalized));
      files.set(normalized, {
        kind: "file",
        data: await readAll(data),
        mtime: stamp(),
      });
      return provider.stat(normalized);
    },
    async mkdir(path: string) {
      const normalized = normalizePath(path);
      if (files.has(normalized)) {
        throw new WorkspaceError("CONFLICT", normalized);
      }
      ensureDir(normalized);
    },
    async remove(path: string, opts: { recursive?: boolean }) {
      const normalized = normalizePath(path);
      if (!files.has(normalized)) {
        throw new WorkspaceError("NOT_FOUND", normalized);
      }
      if (!opts?.recursive) {
        if (childrenOf(normalized).length > 0) {
          throw new WorkspaceError("CONFLICT", normalized);
        }
      }
      for (const key of [...files.keys()]) {
        if (key === normalized || key.startsWith(`${normalized}/`)) {
          files.delete(key);
        }
      }
    },
  };

  files.set(normalizePath(root), { kind: "dir", mtime: stamp() });
  return provider as FileProvider & { files: Map<string, MemoryNode> };
};
