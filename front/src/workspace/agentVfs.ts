import type { Entry, Vfs } from "../agent/vfs";
import { enoent } from "../agent/vfs";
import type { WorkspaceMountRow } from "../db/dbTypes";
import type { BrowserProvider } from "./providers/browser";
import type { FileProvider } from "./providers/types";
import { appendToProvider, renameProviderEntry } from "./entries";
import { baseName, joinPath, normalizePath, parentPath } from "./paths";
import { streamOf, toBytes } from "./bytes";
import {
  notifyWorkspaceFilesChanged,
  type WorkspaceFileChangeKind,
} from "./filesChanged";

type MountBinding = {
  mount: WorkspaceMountRow;
  provider: FileProvider;
};

const UPLOAD_PREFIX = "/uploads";
const READ_ONLY_MESSAGE = "That mount is read-only.";

const isUploads = (path: string) => {
  const normalized = normalizePath(path);
  return normalized === UPLOAD_PREFIX || normalized.startsWith(`${UPLOAD_PREFIX}/`);
};

const assertWritable = (binding: MountBinding) => {
  if (
    binding.mount.readOnly === true ||
    binding.provider.capabilities.write === false
  ) {
    throw new Error(READ_ONLY_MESSAGE);
  }
};

export class WorkspaceAgentVfs implements Vfs {
  constructor(
    private readonly conversation: Vfs,
    readonly workspaceId: string,
    private readonly root: BrowserProvider,
    private readonly mounts: MountBinding[],
  ) {}

  /** The sidebar tree listens for this: a write here is a row that has to appear. */
  private changed(path?: string, kind?: WorkspaceFileChangeKind) {
    notifyWorkspaceFilesChanged(this.workspaceId, { path, kind });
  }

  private binding(path: string): { binding: MountBinding; inner: string } | null {
    const normalized = normalizePath(path);
    let best:
      | { binding: MountBinding; inner: string; mountPath: string }
      | null = null;
    for (const binding of this.mounts) {
      const mountPath = normalizePath(binding.mount.path);
      if (isUploads(mountPath)) continue;
      if (
        normalized !== mountPath &&
        !normalized.startsWith(`${mountPath}/`)
      ) {
        continue;
      }
      if (best && mountPath.length <= best.mountPath.length) continue;
      const inner =
        normalized === mountPath
          ? normalizePath(binding.mount.sourcePath || "/")
          : joinPath(
              binding.mount.sourcePath || "/",
              normalized.slice(mountPath.length),
            );
      best = { binding, inner, mountPath };
    }
    return best ? { binding: best.binding, inner: best.inner } : null;
  }

  private virtualMounts(path: string): string[] {
    const normalized = normalizePath(path);
    const prefix = normalized === "/" ? "/" : `${normalized}/`;
    const names = new Set<string>();
    for (const { mount } of this.mounts) {
      const mountPath = normalizePath(mount.path);
      if (isUploads(mountPath)) continue;
      if (!mountPath.startsWith(prefix) || mountPath === normalized) continue;
      const rest = mountPath.slice(prefix.length);
      const first = rest.split("/")[0];
      if (first) names.add(first);
    }
    return [...names];
  }

  async readFile(path: string): Promise<Uint8Array> {
    const normalized = normalizePath(path);
    if (isUploads(normalized)) return this.conversation.readFile(normalized);
    const routed = this.binding(normalized);
    if (routed) {
      return toBytes(await routed.binding.provider.read(routed.inner));
    }
    try {
      return toBytes(await this.root.read(normalized));
    } catch {
      throw enoent(normalized);
    }
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    const normalized = normalizePath(path);
    if (isUploads(normalized)) {
      await this.conversation.writeFile(normalized, data);
      return;
    }
    const routed = this.binding(normalized);
    // Whether this write creates a row or changes one is the difference between the
    // sidebar's green and amber dots, so ask before the write replaces the evidence.
    const existed = await this.exists(normalized);
    if (routed) {
      assertWritable(routed.binding);
      await routed.binding.provider.write(routed.inner, streamOf(data), {
        overwrite: true,
      });
      this.changed(normalized, existed ? "modify" : "create");
      return;
    }
    if (this.root.capabilities.write === false) {
      throw new Error(READ_ONLY_MESSAGE);
    }
    await this.root.write(normalized, streamOf(data), { overwrite: true });
    this.changed(normalized, existed ? "modify" : "create");
  }

  private async exists(path: string): Promise<boolean> {
    try {
      return (await this.stat(path)) !== null;
    } catch {
      return false;
    }
  }

  async appendFile(path: string, data: Uint8Array | string): Promise<void> {
    const normalized = normalizePath(path);
    if (isUploads(normalized)) {
      const conversation = this.conversation;
      if (!conversation.appendFile) {
        throw new Error("This storage cannot append to a file.");
      }
      await conversation.appendFile(normalized, data);
      return;
    }
    const routed = this.binding(normalized);
    const existed = await this.exists(normalized);
    if (routed) {
      assertWritable(routed.binding);
      await appendToProvider(routed.binding.provider, routed.inner, data);
      this.changed(normalized, existed ? "modify" : "create");
      return;
    }
    if (this.root.capabilities.write === false) {
      throw new Error(READ_ONLY_MESSAGE);
    }
    await appendToProvider(this.root, normalized, data);
    this.changed(normalized, existed ? "modify" : "create");
  }

  async rename(path: string, newName: string): Promise<string> {
    const normalized = normalizePath(path);
    if (isUploads(normalized)) {
      const conversation = this.conversation;
      if (!conversation.rename) {
        throw new Error("This storage cannot rename a file.");
      }
      return conversation.rename(normalized, newName);
    }
    const routed = this.binding(normalized);
    if (routed) {
      assertWritable(routed.binding);
      if (normalized === normalizePath(routed.binding.mount.path)) {
        throw new Error(`Cannot rename the mount point ${normalized}`);
      }
      const inner = await renameProviderEntry(
        routed.binding.provider,
        routed.inner,
        newName,
      );
      const target = joinPath(parentPath(normalized), baseName(inner));
      this.changed(normalized, "remove");
      this.changed(target, "create");
      return target;
    }
    if (normalized === "/") {
      throw new Error("The workspace root cannot be renamed");
    }
    if (this.root.capabilities.write === false) {
      throw new Error(READ_ONLY_MESSAGE);
    }
    const target = await renameProviderEntry(this.root, normalized, newName);
    this.changed(normalized, "remove");
    this.changed(target, "create");
    return target;
  }

  async mkdir(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (isUploads(normalized)) {
      await this.conversation.mkdir(normalized);
      return;
    }
    const routed = this.binding(normalized);
    if (routed) {
      assertWritable(routed.binding);
      await routed.binding.provider.mkdir(routed.inner);
      this.changed(normalized, "create");
      return;
    }
    if (this.root.capabilities.write === false) {
      throw new Error(READ_ONLY_MESSAGE);
    }
    await this.root.mkdir(normalized);
    this.changed(normalized, "create");
  }

  async readdir(path: string): Promise<Entry[]> {
    const normalized = normalizePath(path);
    if (isUploads(normalized)) return this.conversation.readdir(normalized);
    const routed = this.binding(normalized);
    const entries: Entry[] = routed
      ? (await routed.binding.provider.list(routed.inner)).entries.map((entry) => ({
          name: entry.name,
          dir: entry.kind === "dir",
        }))
      : (await this.root.list(normalized)).entries.map((entry) => ({
          name: entry.name,
          dir: entry.kind === "dir",
        }));
    const seen = new Set(entries.map((entry) => entry.name));
    for (const name of this.virtualMounts(normalized)) {
      if (!seen.has(name)) entries.push({ name, dir: true });
    }
    return entries.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
  }

  async stat(path: string): Promise<{ dir: boolean } | null> {
    const normalized = normalizePath(path);
    if (isUploads(normalized)) return this.conversation.stat(normalized);
    if (normalized === "/") return { dir: true };
    const routed = this.binding(normalized);
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
      const mountPath = normalizePath(mount.path);
      if (isUploads(mountPath)) continue;
      if (mountPath.startsWith(`${normalized}/`)) return { dir: true };
    }
    try {
      const entry = await this.root.stat(normalized);
      return { dir: entry.kind === "dir" };
    } catch {
      return null;
    }
  }

  async remove(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (isUploads(normalized)) {
      await this.conversation.remove(normalized);
      return;
    }
    const routed = this.binding(normalized);
    if (routed) {
      assertWritable(routed.binding);
      if (normalized === normalizePath(routed.binding.mount.path)) {
        throw new Error(`Cannot remove the mount point ${normalized}`);
      }
      await routed.binding.provider.remove(routed.inner, { recursive: true });
      this.changed(normalized, "remove");
      return;
    }
    if (this.root.capabilities.write === false) {
      throw new Error(READ_ONLY_MESSAGE);
    }
    await this.root.remove(normalized, { recursive: true });
    this.changed(normalized, "remove");
  }

  async stamp(path: string): Promise<string | null> {
    const normalized = normalizePath(path);
    if (isUploads(normalized)) return this.conversation.stamp?.(normalized) ?? null;
    const routed = this.binding(normalized);
    try {
      if (routed) {
        const entry = await routed.binding.provider.stat(routed.inner);
        return `${entry.mtime ?? ""}:${entry.size ?? ""}`;
      }
      const entry = await this.root.stat(normalized);
      return `${entry.mtime ?? ""}:${entry.size ?? ""}`;
    } catch {
      return null;
    }
  }

  mountLabels(): string[] {
    return this.mounts
      .map(({ mount }) => normalizePath(mount.path))
      .filter((mountPath) => !isUploads(mountPath));
  }

  uploadPath(path: string): boolean {
    return isUploads(path);
  }
}
