import type { WorkspaceCapabilities, WorkspaceFileEntry } from "../../db/dbTypes";
import { getSourceHandle } from "../../db/workspaceDb";
import { defaultCapabilities } from "../capabilities";
import { baseName, joinPath, normalizePath, parentPath } from "../paths";
import type { DirectoryPage, FileProvider, QuotaInfo } from "./types";
import { WorkspaceError } from "./types";

async function getDir(
  root: FileSystemDirectoryHandle,
  path: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const segment of normalizePath(path).split("/").filter(Boolean)) {
    dir = await dir.getDirectoryHandle(segment, { create });
  }
  return dir;
}

async function getFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemFileHandle> {
  const name = baseName(path);
  if (!name) throw new WorkspaceError("NOT_FOUND", "Not a file path");
  const dir = await getDir(root, parentPath(path));
  return dir.getFileHandle(name);
}

async function entryFor(
  sourceId: string,
  path: string,
  name: string,
  handle: FileSystemHandle,
): Promise<WorkspaceFileEntry> {
  if (handle.kind === "directory") {
    let childCount = 0;
    try {
      // @ts-expect-error entries() is missing from older DOM typings
      for await (const _ of handle.entries()) childCount += 1;
    } catch {
      childCount = 0;
    }
    return { sourceId, path, name, kind: "dir", childCount };
  }
  const file = await handle.getFile();
  return {
    sourceId,
    path,
    name,
    kind: "file",
    size: file.size,
    mtime: new Date(file.lastModified).toISOString(),
    mime: file.type || undefined,
  };
}

async function permission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  if (!handle.queryPermission) return "granted";
  return handle.queryPermission({ mode: "readwrite" });
}

export class LocalProvider implements FileProvider {
  readonly kind = "local" as const;
  readonly capabilities: WorkspaceCapabilities = defaultCapabilities("local");
  status: "connected" | "needs-permission" | "offline" | "error" = "offline";
  private root: FileSystemDirectoryHandle | null = null;

  constructor(
    readonly sourceId: string,
    readonly handleKey: string,
  ) {}

  async connect() {
    const handle = await getSourceHandle(this.handleKey);
    if (!handle) {
      this.status = "error";
      throw new WorkspaceError("NOT_FOUND", "Folder handle is missing");
    }
    this.root = handle;
    const state = await permission(handle);
    if (state !== "granted") {
      this.status = "needs-permission";
      throw new WorkspaceError("PERMISSION_DENIED");
    }
    this.status = "connected";
  }

  async requestAccess() {
    if (!this.root) {
      const handle = await getSourceHandle(this.handleKey);
      if (!handle) throw new WorkspaceError("NOT_FOUND", "Folder handle is missing");
      this.root = handle;
    }
    const granted = await this.root.requestPermission({ mode: "readwrite" });
    if (granted !== "granted") throw new WorkspaceError("PERMISSION_DENIED");
    this.status = "connected";
  }

  private handle(): FileSystemDirectoryHandle {
    if (!this.root) throw new WorkspaceError("PERMISSION_DENIED");
    return this.root;
  }

  async list(path: string, cursor?: string): Promise<DirectoryPage> {
    let dir: FileSystemDirectoryHandle;
    try {
      dir = await getDir(this.handle(), path);
    } catch {
      throw new WorkspaceError("NOT_FOUND", path);
    }
    const entries: WorkspaceFileEntry[] = [];
    // @ts-expect-error entries() is missing from older DOM typings
    for await (const [name, handle] of dir.entries()) {
      entries.push(
        await entryFor(
          this.sourceId,
          joinPath(path, name),
          name,
          handle,
        ),
      );
    }
    entries.sort(
      (a, b) =>
        Number(b.kind === "dir") - Number(a.kind === "dir") ||
        a.name.localeCompare(b.name),
    );
    const start = cursor ? Number(cursor) : 0;
    const page = entries.slice(start, start + 200);
    return {
      entries: page,
      next: start + page.length < entries.length ? String(start + page.length) : undefined,
    };
  }

  async stat(path: string): Promise<WorkspaceFileEntry> {
    const normalized = normalizePath(path);
    if (normalized === "/") {
      return { sourceId: this.sourceId, path: "/", name: "/", kind: "dir" };
    }
    const name = baseName(normalized);
    const parent = await getDir(this.handle(), parentPath(normalized));
    try {
      return await entryFor(
        this.sourceId,
        normalized,
        name,
        await parent.getFileHandle(name),
      );
    } catch {
      try {
        return await entryFor(
          this.sourceId,
          normalized,
          name,
          await parent.getDirectoryHandle(name),
        );
      } catch {
        throw new WorkspaceError("NOT_FOUND", normalized);
      }
    }
  }

  async read(path: string, range?: { start: number; end: number }) {
    let file: File;
    try {
      file = await (await getFile(this.handle(), path)).getFile();
    } catch {
      throw new WorkspaceError("NOT_FOUND", path);
    }
    const slice = range ? file.slice(range.start, range.end) : file;
    return slice.stream();
  }

  async write(
    path: string,
    data: ReadableStream<Uint8Array>,
    opts: { size?: number; overwrite: boolean },
  ): Promise<WorkspaceFileEntry> {
    const normalized = normalizePath(path);
    const name = baseName(normalized);
    const dir = await getDir(this.handle(), parentPath(normalized), true);
    try {
      await dir.getFileHandle(name);
      if (!opts.overwrite) throw new WorkspaceError("CONFLICT", normalized);
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
    }
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    try {
      await data.pipeTo(writable as unknown as WritableStream<Uint8Array>);
    } catch (error) {
      await writable.abort().catch(() => {});
      throw error;
    }
    return this.stat(normalized);
  }

  async mkdir(path: string) {
    await getDir(this.handle(), path, true);
  }

  async remove(path: string, opts: { recursive: boolean }) {
    const normalized = normalizePath(path);
    const name = baseName(normalized);
    const dir = await getDir(this.handle(), parentPath(normalized));
    await dir.removeEntry(name, { recursive: opts.recursive });
  }

  async copy(from: string, to: string) {
    const entry = await this.stat(from);
    if (entry.kind === "dir") {
      await this.mkdir(to);
      const { entries } = await this.list(from);
      for (const child of entries) {
        await this.copy(child.path, joinPath(to, child.name));
      }
      return;
    }
    await this.write(to, await this.read(from), {
      size: entry.size,
      overwrite: false,
    });
  }

  async move(from: string, to: string) {
    await this.copy(from, to);
    await this.remove(from, { recursive: true });
  }

  async quota(): Promise<QuotaInfo | null> {
    return null;
  }
}
