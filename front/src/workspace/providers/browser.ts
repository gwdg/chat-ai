import type { WorkspaceCapabilities, WorkspaceFileEntry } from "../../db/dbTypes";
import {
  deleteSourceNodes,
  ensureSourceDir,
  getSourceBlob,
  getSourceNode,
  listSourceNodes,
  removeSourcePath,
  sourceUsage,
  writeSourceFile,
} from "../../db/workspaceVfs";
import { defaultCapabilities } from "../capabilities";
import { baseName, joinPath, normalizePath } from "../paths";
import type { DirectoryPage, FileProvider, QuotaInfo } from "./types";
import { WorkspaceError } from "./types";

const readAll = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      length += value.length;
    }
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data;
};

export async function clearBrowserSourceData(sourceId: string): Promise<void> {
  await deleteSourceNodes(sourceId);
}

export class BrowserProvider implements FileProvider {
  readonly kind = "browser" as const;
  readonly capabilities: WorkspaceCapabilities = defaultCapabilities("browser");
  status: "connected" | "needs-permission" | "offline" | "error" = "offline";

  constructor(readonly sourceId: string) {}

  async connect() {
    await ensureSourceDir(this.sourceId, "/");
    this.status = "connected";
  }

  private async entry(node: {
    path: string;
    name: string;
    kind: "file" | "dir";
    size?: number;
    mtime?: string;
    mime?: string;
  }): Promise<WorkspaceFileEntry> {
    let childCount: number | undefined;
    if (node.kind === "dir") {
      const children = await listSourceNodes(this.sourceId, node.path);
      childCount = children.length;
    }
    return {
      sourceId: this.sourceId,
      path: node.path,
      name: node.name,
      kind: node.kind,
      size: node.size,
      mtime: node.mtime,
      mime: node.mime,
      childCount,
    };
  }

  async list(path: string, cursor?: string): Promise<DirectoryPage> {
    const normalized = normalizePath(path);
    const nodes = await listSourceNodes(this.sourceId, normalized);
    const start = cursor ? Number(cursor) : 0;
    const page = nodes.slice(start, start + 200);
    return {
      entries: await Promise.all(page.map((node) => this.entry(node))),
      next:
        start + page.length < nodes.length ? String(start + page.length) : undefined,
    };
  }

  async stat(path: string): Promise<WorkspaceFileEntry> {
    const normalized = normalizePath(path);
    if (normalized === "/") {
      return { sourceId: this.sourceId, path: "/", name: "/", kind: "dir" };
    }
    const node = await getSourceNode(this.sourceId, normalized);
    if (!node) throw new WorkspaceError("NOT_FOUND", normalized);
    return this.entry(node);
  }

  async read(path: string, range?: { start: number; end: number }) {
    const normalized = normalizePath(path);
    const node = await getSourceNode(this.sourceId, normalized);
    if (!node || node.kind !== "file") {
      throw new WorkspaceError("NOT_FOUND", normalized);
    }
    const blob = await getSourceBlob(this.sourceId, node.id);
    if (!blob) throw new WorkspaceError("NOT_FOUND", normalized);
    const bytes = range ? blob.slice(range.start, range.end) : blob;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
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
    const existing = await getSourceNode(this.sourceId, normalized);
    if (existing && !opts.overwrite) {
      throw new WorkspaceError("CONFLICT", normalized);
    }
    const bytes = await readAll(data);
    const node = await writeSourceFile(this.sourceId, normalized, bytes);
    return this.entry(node);
  }

  async mkdir(path: string) {
    await ensureSourceDir(this.sourceId, path);
  }

  async remove(path: string, opts: { recursive: boolean }) {
    await removeSourcePath(this.sourceId, path, opts.recursive);
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
    const usage = await sourceUsage(this.sourceId);
    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota ?? 0;
      return {
        usage,
        quota,
        free: quota ? Math.max(0, quota - usage) : undefined,
        scope: "origin",
      };
    } catch {
      return { usage, quota: 0, free: undefined, scope: "origin" };
    }
  }
}
