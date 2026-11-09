// The virtual filesystem the agent works on. Paths are absolute and POSIX-style ("/notes/a.txt").
//
// Every backend implements `Vfs`, so a later backend (an encrypted server sync, an SQLite file)
// can be swapped in or layered on top without touching the tools.

export interface Entry {
  name: string;
  dir: boolean;
}

export interface Vfs {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  mkdir(path: string): Promise<void>;
  readdir(path: string): Promise<Entry[]>;
  /** Resolves to null when the path does not exist. */
  stat(path: string): Promise<{ dir: boolean } | null>;
  remove(path: string): Promise<void>;
  /** Changes whenever the file's content does; null when the file does not exist. Meant for sync. */
  stamp?(path: string): Promise<string | null>;
}

export const enoent = (path: string) =>
  Object.assign(new Error(`ENOENT: no such file or directory, '${path}'`), { code: "ENOENT" });

export const parts = (path: string) => path.split("/").filter((p) => p && p !== ".");
export const normalize = (path: string) => `/${parts(path).join("/")}`;
const toBytes = (data: Uint8Array | string) => (typeof data === "string" ? new TextEncoder().encode(data) : data);

/**
 * Backed by a FileSystemDirectoryHandle. The same class serves the browser's private
 * storage (OPFS) and a real folder picked with showDirectoryPicker().
 */
export class HandleFs implements Vfs {
  constructor(private root: FileSystemDirectoryHandle) {}

  private async dir(segments: string[], create = false): Promise<FileSystemDirectoryHandle> {
    let handle = this.root;
    for (const segment of segments) handle = await handle.getDirectoryHandle(segment, { create });
    return handle;
  }

  private async file(path: string): Promise<File> {
    const segments = parts(path);
    const name = segments.pop();
    try {
      if (!name) throw enoent(path);
      return await (await (await this.dir(segments)).getFileHandle(name)).getFile();
    } catch {
      throw enoent(path);
    }
  }

  async readFile(path: string) {
    return new Uint8Array(await (await this.file(path)).arrayBuffer());
  }

  async writeFile(path: string, data: Uint8Array | string) {
    const segments = parts(path);
    const name = segments.pop();
    if (!name) throw new Error(`Not a file path: ${path}`);
    const file = await (await this.dir(segments, true)).getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(toBytes(data) as Uint8Array<ArrayBuffer>);
    await writable.close();
  }

  async mkdir(path: string) {
    await this.dir(parts(path), true);
  }

  async readdir(path: string) {
    let dir: FileSystemDirectoryHandle;
    try {
      dir = await this.dir(parts(path));
    } catch {
      throw enoent(path);
    }
    const entries: Entry[] = [];
    // @ts-expect-error entries() is missing from older DOM typings
    for await (const [name, handle] of dir.entries()) entries.push({ name, dir: handle.kind === "directory" });
    return entries.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
  }

  async stat(path: string) {
    const segments = parts(path);
    const name = segments.pop();
    if (!name) return { dir: true };
    try {
      const parent = await this.dir(segments);
      try {
        await parent.getFileHandle(name);
        return { dir: false };
      } catch {
        await parent.getDirectoryHandle(name);
        return { dir: true };
      }
    } catch {
      return null;
    }
  }

  async stamp(path: string) {
    try {
      const file = await this.file(path);
      return `${file.lastModified}:${file.size}`;
    } catch {
      return null;
    }
  }

  async remove(path: string) {
    const segments = parts(path);
    const name = segments.pop();
    if (!name) {
      // @ts-expect-error keys() is missing from older DOM typings
      for await (const key of this.root.keys()) await this.root.removeEntry(key, { recursive: true });
      return;
    }
    try {
      await (await this.dir(segments)).removeEntry(name, { recursive: true });
    } catch {
      // already gone
    }
  }
}

/**
 * Routes paths below a mount point to another Vfs, e.g. a local folder at "/local/<name>".
 * Mount points show up as directories in their parent's listing.
 */
export class MountFs implements Vfs {
  readonly mounts = new Map<string, Vfs>();

  constructor(private base: Vfs) {}

  mount(at: string, fs: Vfs) {
    this.mounts.set(normalize(at), fs);
  }

  unmount(at: string) {
    this.mounts.delete(normalize(at));
  }

  /** The backend responsible for `path`, and the path inside it. */
  private route(path: string): [Vfs, string] {
    const key = normalize(path);
    for (const [at, fs] of this.mounts) {
      if (key === at) return [fs, "/"];
      if (key.startsWith(`${at}/`)) return [fs, key.slice(at.length)];
    }
    return [this.base, key];
  }

  readFile(path: string) {
    const [fs, p] = this.route(path);
    return fs.readFile(p);
  }

  writeFile(path: string, data: Uint8Array | string) {
    const [fs, p] = this.route(path);
    return fs.writeFile(p, data);
  }

  mkdir(path: string) {
    const [fs, p] = this.route(path);
    return fs.mkdir(p);
  }

  async readdir(path: string) {
    const [fs, p] = this.route(path);
    const key = normalize(path);
    const prefix = key === "/" ? "/" : `${key}/`;
    // Mount points directly below this directory, and the directories leading to deeper ones.
    const virtual = new Set<string>();
    for (const at of this.mounts.keys()) {
      if (at.startsWith(prefix)) virtual.add(at.slice(prefix.length).split("/")[0]);
    }
    let entries: Entry[] = [];
    try {
      entries = await fs.readdir(p);
    } catch (error) {
      if (!virtual.size) throw error;
    }
    const names = new Set(entries.map((entry) => entry.name));
    return [...entries, ...[...virtual].filter((name) => !names.has(name)).map((name) => ({ name, dir: true }))];
  }

  async stat(path: string) {
    const key = normalize(path);
    for (const at of this.mounts.keys()) if (at.startsWith(`${key}/`)) return { dir: true };
    const [fs, p] = this.route(path);
    return fs.stat(p);
  }

  remove(path: string) {
    const [fs, p] = this.route(path);
    // Removing a mount point would empty the user's folder.
    if (p === "/" && fs !== this.base) throw new Error(`Cannot remove the mount point ${path}`);
    return fs.remove(p);
  }

  async stamp(path: string) {
    const [fs, p] = this.route(path);
    return (await fs.stamp?.(p)) ?? null;
  }
}

export type Change = { path: string; kind: "write" | "remove" };

/** Wraps a Vfs so every mutation is reported to `onChange` after it succeeded. */
export function observe(fs: Vfs, onChange: (change: Change) => void): Vfs {
  return {
    readFile: (p) => fs.readFile(p),
    readdir: (p) => fs.readdir(p),
    stat: (p) => fs.stat(p),
    mkdir: (p) => fs.mkdir(p),
    stamp: (p) => fs.stamp?.(p) ?? Promise.resolve(null),
    async writeFile(path, data) {
      await fs.writeFile(path, data);
      onChange({ path: normalize(path), kind: "write" });
    },
    async remove(path) {
      await fs.remove(path);
      onChange({ path: normalize(path), kind: "remove" });
    },
  };
}

/** Directories that are never listed; a mounted project folder would otherwise drag them in. */
const SKIPPED_DIRS = new Set(["node_modules", ".git"]);

/** All file paths below `dir`, depth first. */
export async function walk(fs: Vfs, dir = "/"): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir)) {
    const path = `${dir === "/" ? "" : dir}/${entry.name}`;
    if (!entry.dir) out.push(path);
    else if (!SKIPPED_DIRS.has(entry.name)) out.push(...(await walk(fs, path)));
  }
  return out;
}

/**
 * A local folder whose read-write permission may have lapsed (it does on every reload).
 * Before each operation it checks the permission and, if needed, has `ask` get it back from
 * the user — so the user is only asked when the agent actually touches the folder.
 */
export class PermissionFs implements Vfs {
  private inner: HandleFs;
  private pending: Promise<boolean> | null = null;

  constructor(
    private handle: FileSystemDirectoryHandle,
    private ask: (handle: FileSystemDirectoryHandle) => Promise<boolean>,
  ) {
    this.inner = new HandleFs(handle);
  }

  private async ready() {
    // @ts-expect-error queryPermission() is missing from the DOM typings
    if ((await this.handle.queryPermission({ mode: "readwrite" })) === "granted") return;
    // Parallel tool calls share one prompt
    this.pending ??= this.ask(this.handle).finally(() => (this.pending = null));
    if (!(await this.pending)) throw new Error(`The user did not allow access to the folder "${this.handle.name}"`);
  }

  async readFile(path: string) {
    await this.ready();
    return this.inner.readFile(path);
  }

  async writeFile(path: string, data: Uint8Array | string) {
    await this.ready();
    return this.inner.writeFile(path, data);
  }

  async mkdir(path: string) {
    await this.ready();
    return this.inner.mkdir(path);
  }

  async readdir(path: string) {
    await this.ready();
    return this.inner.readdir(path);
  }

  async stat(path: string) {
    await this.ready();
    return this.inner.stat(path);
  }

  async stamp(path: string) {
    await this.ready();
    return this.inner.stamp(path);
  }

  async remove(path: string) {
    await this.ready();
    return this.inner.remove(path);
  }
}
