import type { SyncStore } from "./types";

/**
 * In-memory store with the same contract as the SAIA filesystem adapter.
 *
 * It exists so the engine and the namespaces can be tested without a network
 * or an MCP handshake, and so a dry run can be built on top of it later. Paths
 * are normalised to a leading `/` and no trailing slash, like the provider.
 */
const normalize = (path: string): string => {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  const collapsed = withSlash.replace(/\/{2,}/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : "/";
};

const parentOf = (path: string): string => {
  const normalized = normalize(path);
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
};

const baseOf = (path: string): string => {
  const normalized = normalize(path);
  return normalized.slice(normalized.lastIndexOf("/") + 1);
};

export class MemorySyncStore implements SyncStore {
  private files = new Map<string, Uint8Array>();
  private directories = new Set<string>(["/"]);
  /** Every write, so a test can assert that nothing is written twice. */
  readonly writes: string[] = [];
  readonly removed: string[] = [];

  async list(dir: string) {
    const normalized = normalize(dir);
    const prefix = normalized === "/" ? "/" : `${normalized}/`;
    const names = new Set<string>();
    for (const path of this.files.keys()) {
      if (path.startsWith(prefix)) {
        const rest = path.slice(prefix.length);
        if (rest && !rest.includes("/")) names.add(rest);
      }
    }
    for (const path of this.directories) {
      if (path !== normalized && path.startsWith(prefix)) {
        const rest = path.slice(prefix.length);
        if (rest && !rest.includes("/")) names.add(rest);
      }
    }
    return [...names].sort().map((name) => ({
      name,
      size: this.files.get(`${prefix}${name}`)?.byteLength,
      dir: this.directories.has(`${prefix}${name}`),
    }));
  }

  async read(path: string): Promise<Uint8Array> {
    const bytes = this.files.get(normalize(path));
    if (!bytes) throw new Error(`NOT_FOUND ${normalize(path)}`);
    return bytes.slice();
  }

  async write(path: string, bytes: Uint8Array): Promise<void> {
    const normalized = normalize(path);
    const parent = parentOf(normalized);
    if (!this.directories.has(parent)) {
      throw new Error(`DIRECTORY_MISSING ${parent}`);
    }
    this.files.set(normalized, bytes.slice());
    this.writes.push(normalized);
  }

  async remove(path: string): Promise<void> {
    const normalized = normalize(path);
    this.files.delete(normalized);
    this.directories.delete(normalized);
    this.removed.push(normalized);
    for (const key of [...this.files.keys()]) {
      if (key.startsWith(`${normalized}/`)) this.files.delete(key);
    }
    for (const key of [...this.directories]) {
      if (key.startsWith(`${normalized}/`)) this.directories.delete(key);
    }
  }

  async ensureDir(dir: string): Promise<void> {
    const normalized = normalize(dir);
    const parts = normalized.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current += `/${part}`;
      this.directories.add(current);
    }
  }

  async exists(path: string): Promise<boolean> {
    const normalized = normalize(path);
    return this.files.has(normalized) || this.directories.has(normalized);
  }

  /** Test helper: every stored path. */
  paths(): string[] {
    return [...this.files.keys()].sort();
  }

  /** Test helper: write bytes without going through `ensureDir`. */
  put(path: string, bytes: Uint8Array): void {
    const normalized = normalize(path);
    const parent = parentOf(normalized);
    if (parent !== "/") this.directories.add(parent);
    this.files.set(normalized, bytes.slice());
  }

  /** Test helper: name of a stored file. */
  nameOf(path: string): string {
    return baseOf(path);
  }
}
