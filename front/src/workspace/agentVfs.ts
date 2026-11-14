import type { Entry, Vfs } from "../agent/vfs";
import { enoent } from "../agent/vfs";
import type { WorkspaceMountRow } from "../db/dbTypes";
import type { BrowserProvider } from "./providers/browser";
import type { FileProvider } from "./providers/types";
import { joinPath, normalizePath } from "./paths";

type MountBinding = {
  mount: WorkspaceMountRow;
  provider: FileProvider;
};

const UPLOAD_PREFIX = "/uploads";

const toBytes = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
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

const streamOf = (data: Uint8Array | string): ReadableStream<Uint8Array> => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
};

const isUploads = (path: string) => {
  const normalized = normalizePath(path);
  return normalized === UPLOAD_PREFIX || normalized.startsWith(`${UPLOAD_PREFIX}/`);
};

export class WorkspaceAgentVfs implements Vfs {
  constructor(
    private readonly conversation: Vfs,
    readonly workspaceId: string,
    private readonly root: BrowserProvider,
    private readonly mounts: MountBinding[],
  ) {}

  private binding(path: string): { binding: MountBinding; inner: string } | null {
    const normalized = normalizePath(path);
    for (const binding of this.mounts) {
      const mountPath = normalizePath(binding.mount.path);
      if (normalized === mountPath) {
        return {
          binding,
          inner: normalizePath(binding.mount.sourcePath || "/"),
        };
      }
      if (normalized.startsWith(`${mountPath}/`)) {
        const suffix = normalized.slice(mountPath.length);
        return {
          binding,
          inner: joinPath(binding.mount.sourcePath || "/", suffix),
        };
      }
    }
    return null;
  }

  private virtualMounts(path: string): string[] {
    const normalized = normalizePath(path);
    const prefix = normalized === "/" ? "/" : `${normalized}/`;
    const names = new Set<string>();
    for (const { mount } of this.mounts) {
      const mountPath = normalizePath(mount.path);
      if (!mountPath.startsWith(prefix) || mountPath === normalized) continue;
      const rest = mountPath.slice(prefix.length);
      const first = rest.split("/")[0];
      if (first) names.add(first);
    }
    return [...names];
  }

  async readFile(path: string): Promise<Uint8Array> {
    if (isUploads(path)) return this.conversation.readFile(path);
    const routed = this.binding(path);
    if (routed) {
      return toBytes(await routed.binding.provider.read(routed.inner));
    }
    try {
      return toBytes(await this.root.read(path));
    } catch {
      throw enoent(path);
    }
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    if (isUploads(path)) {
      await this.conversation.writeFile(path, data);
      return;
    }
    const routed = this.binding(path);
    if (routed) {
      await routed.binding.provider.write(routed.inner, streamOf(data), {
        overwrite: true,
      });
      return;
    }
    await this.root.write(path, streamOf(data), { overwrite: true });
  }

  async mkdir(path: string): Promise<void> {
    if (isUploads(path)) {
      await this.conversation.mkdir(path);
      return;
    }
    const routed = this.binding(path);
    if (routed) {
      await routed.binding.provider.mkdir(routed.inner);
      return;
    }
    await this.root.mkdir(path);
  }

  async readdir(path: string): Promise<Entry[]> {
    if (isUploads(path)) return this.conversation.readdir(path);
    const routed = this.binding(path);
    const entries: Entry[] = routed
      ? (await routed.binding.provider.list(routed.inner)).entries.map((entry) => ({
          name: entry.name,
          dir: entry.kind === "dir",
        }))
      : (await this.root.list(path)).entries.map((entry) => ({
          name: entry.name,
          dir: entry.kind === "dir",
        }));
    const seen = new Set(entries.map((entry) => entry.name));
    for (const name of this.virtualMounts(path)) {
      if (!seen.has(name)) entries.push({ name, dir: true });
    }
    return entries.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
  }

  async stat(path: string): Promise<{ dir: boolean } | null> {
    if (isUploads(path)) return this.conversation.stat(path);
    const normalized = normalizePath(path);
    if (normalized === "/") return { dir: true };
    const routed = this.binding(path);
    if (routed) {
      try {
        const entry = await routed.binding.provider.stat(routed.inner);
        return { dir: entry.kind === "dir" };
      } catch {
        return null;
      }
    }
    if (this.virtualMounts(normalized).length > 0) return { dir: true };
    for (const { mount } of this.mounts) {
      if (normalizePath(mount.path).startsWith(`${normalized}/`)) return { dir: true };
    }
    try {
      const entry = await this.root.stat(path);
      return { dir: entry.kind === "dir" };
    } catch {
      return null;
    }
  }

  async remove(path: string): Promise<void> {
    if (isUploads(path)) {
      await this.conversation.remove(path);
      return;
    }
    const routed = this.binding(path);
    if (routed) {
      if (normalizePath(path) === normalizePath(routed.binding.mount.path)) {
        throw new Error(`Cannot remove the mount point ${path}`);
      }
      await routed.binding.provider.remove(routed.inner, { recursive: true });
      return;
    }
    await this.root.remove(path, { recursive: true });
  }

  async stamp(path: string): Promise<string | null> {
    if (isUploads(path)) return this.conversation.stamp?.(path) ?? null;
    const routed = this.binding(path);
    try {
      if (routed) {
        const entry = await routed.binding.provider.stat(routed.inner);
        return `${entry.mtime ?? ""}:${entry.size ?? ""}`;
      }
      const entry = await this.root.stat(path);
      return `${entry.mtime ?? ""}:${entry.size ?? ""}`;
    } catch {
      return null;
    }
  }

  mountLabels(): string[] {
    return this.mounts.map(({ mount }) => normalizePath(mount.path));
  }

  uploadPath(path: string): boolean {
    return isUploads(path);
  }
}
