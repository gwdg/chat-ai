// A `FileProvider` over the chat's own browser storage: OPFS at `chats/<conversationId>`
// (workspace/chatStorage.ts).
//
// This is the tree the agent writes to in a chat without a workspace (see agent/workspace.ts),
// including the `/artefacts` uploads. An attached workspace links the same tree in at
// `/chats/<conversationId>`, so the files stay with the chat. The workspace file browser is reused
// on top of it, so the chat's files can be managed with the same controls.
import type { WorkspaceCapabilities, WorkspaceFileEntry } from "../../db/dbTypes";
import { defaultCapabilities } from "../capabilities";
import { chatStorageDir } from "../chatStorage";
import { joinPath, normalizePath } from "../paths";
import { readAll } from "../bytes";
import type { DirectoryPage, FileProvider, QuotaInfo } from "./types";
import { WorkspaceError } from "./types";

const PAGE_SIZE = 200;

const segments = (path: string) =>
  normalizePath(path).split("/").filter(Boolean);

export class ConversationStorageProvider implements FileProvider {
  readonly kind = "chat" as const;
  readonly capabilities: WorkspaceCapabilities = defaultCapabilities("chat");
  status: "connected" | "needs-permission" | "offline" | "error" = "offline";

  private root: Promise<FileSystemDirectoryHandle> | null = null;

  constructor(
    readonly sourceId: string,
    private readonly conversationId: string,
  ) {}

  private rootHandle(): Promise<FileSystemDirectoryHandle> {
    this.root ??= chatStorageDir(this.conversationId);
    return this.root;
  }

  async connect() {
    await this.rootHandle();
    this.status = "connected";
  }

  private async dir(path: string): Promise<FileSystemDirectoryHandle> {
    let handle = await this.rootHandle();
    for (const segment of segments(path)) {
      handle = await handle.getDirectoryHandle(segment);
    }
    return handle;
  }

  private async handle(path: string): Promise<FileSystemHandle> {
    const parts = segments(path);
    const name = parts.pop();
    if (!name) throw new WorkspaceError("NOT_FOUND", normalizePath(path));
    const parent = parts.length
      ? await this.dir(`/${parts.join("/")}`)
      : await this.rootHandle();
    try {
      return await parent.getFileHandle(name);
    } catch {
      // fall through to a directory
    }
    try {
      return await parent.getDirectoryHandle(name);
    } catch {
      throw new WorkspaceError("NOT_FOUND", normalizePath(path));
    }
  }

  private async entry(
    path: string,
    handle: FileSystemHandle,
  ): Promise<WorkspaceFileEntry> {
    const normalized = normalizePath(path);
    const item: WorkspaceFileEntry = {
      sourceId: this.sourceId,
      path: normalized,
      name: normalized.split("/").pop() || "/",
      kind: handle.kind === "directory" ? "dir" : "file",
    };
    if (handle.kind === "file") {
      const file = await (handle as FileSystemFileHandle).getFile();
      item.size = file.size;
      item.mtime = new Date(file.lastModified).toISOString();
      if (file.type) item.mime = file.type;
    } else {
      let childCount = 0;
      // @ts-expect-error keys() is missing from older DOM typings
      for await (const _name of (handle as FileSystemDirectoryHandle).keys()) {
        childCount++;
      }
      item.childCount = childCount;
    }
    return item;
  }

  async list(path: string, cursor?: string): Promise<DirectoryPage> {
    const dir = await this.dir(path);
    const handles: [string, FileSystemHandle][] = [];
    // @ts-expect-error entries() is missing from older DOM typings
    for await (const [name, handle] of dir.entries()) {
      handles.push([name, handle]);
    }
    handles.sort(
      ([nameA, a], [nameB, b]) =>
        Number(b.kind === "directory") - Number(a.kind === "directory") ||
        nameA.localeCompare(nameB),
    );
    const start = cursor ? Number(cursor) : 0;
    const page = handles.slice(start, start + PAGE_SIZE);
    return {
      entries: await Promise.all(
        page.map(([name, handle]) =>
          this.entry(joinPath(path, name), handle),
        ),
      ),
      next:
        start + page.length < handles.length
          ? String(start + page.length)
          : undefined,
    };
  }

  async stat(path: string): Promise<WorkspaceFileEntry> {
    return this.entry(path, await this.handle(path));
  }

  async read(path: string, range?: { start: number; end: number }) {
    const handle = await this.handle(path);
    if (handle.kind !== "file") {
      throw new WorkspaceError("NOT_FOUND", normalizePath(path));
    }
    const file = await (handle as FileSystemFileHandle).getFile();
    const blob = range ? file.slice(range.start, range.end) : file;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(blob);
        controller.close();
      },
    });
  }

  async write(
    path: string,
    data: ReadableStream<Uint8Array>,
    opts: { size?: number; overwrite: boolean },
  ): Promise<WorkspaceFileEntry> {
    const normalized = normalizePath(path);
    if (!opts.overwrite) {
      const exists = await this.handle(normalized).then(
        () => true,
        () => false,
      );
      if (exists) throw new WorkspaceError("CONFLICT", normalized);
    }
    const parts = segments(normalized);
    const name = parts.pop();
    if (!name) throw new WorkspaceError("PROVIDER_ERROR", "Not a file path");
    const parent = parts.length
      ? await this.dir(`/${parts.join("/")}`)
      : await this.rootHandle();
    const handle = await parent.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(await readAll(data));
    } finally {
      await writable.close();
    }
    return this.entry(normalized, handle);
  }

  async mkdir(path: string) {
    let handle = await this.rootHandle();
    for (const segment of segments(path)) {
      handle = await handle.getDirectoryHandle(segment, { create: true });
    }
  }

  /** OPFS: open the file with `keepExistingData` and seek to its end. Parents are created. */
  async append(path: string, data: Uint8Array | string) {
    const normalized = normalizePath(path);
    const parts = segments(normalized);
    const name = parts.pop();
    if (!name) throw new WorkspaceError("PROVIDER_ERROR", "Not a file path");
    if (parts.length) await this.mkdir(`/${parts.join("/")}`);
    const parent = parts.length
      ? await this.dir(`/${parts.join("/")}`)
      : await this.rootHandle();
    const handle = await parent.getFileHandle(name, { create: true });
    const size = (await handle.getFile()).size;
    const writable = await handle.createWritable({ keepExistingData: true });
    try {
      const bytes =
        typeof data === "string" ? new TextEncoder().encode(data) : data;
      await writable.seek(size);
      await writable.write(bytes as Uint8Array<ArrayBuffer>);
    } finally {
      await writable.close();
    }
  }

  async remove(path: string, opts: { recursive: boolean }) {
    const parts = segments(path);
    const name = parts.pop();
    if (!name) throw new WorkspaceError("PROVIDER_ERROR", "Not a file path");
    const parent = parts.length
      ? await this.dir(`/${parts.join("/")}`)
      : await this.rootHandle();
    try {
      await parent.removeEntry(name, { recursive: opts.recursive });
    } catch {
      throw new WorkspaceError("NOT_FOUND", normalizePath(path));
    }
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
    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota ?? 0;
      const usage = estimate.usage ?? 0;
      return {
        usage,
        quota,
        free: quota ? Math.max(0, quota - usage) : undefined,
        scope: "origin",
      };
    } catch {
      return null;
    }
  }
}
