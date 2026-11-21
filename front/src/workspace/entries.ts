import type { FileProvider, ProviderEntry } from "./providers/types";
import { WorkspaceError } from "./providers/types";
import { readAll, streamOf } from "./bytes";
import { baseName, joinPath, normalizePath, parentPath } from "./paths";

/** Provider listings are paginated (Arcana, MCP); read every page up to the same safety cap. */
export async function listAllEntries(
  provider: Pick<FileProvider, "list">,
  path: string,
): Promise<ProviderEntry[]> {
  const entries: ProviderEntry[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const result = await provider.list(path, cursor);
    entries.push(...result.entries);
    cursor = result.next;
    if (!cursor) break;
  }
  return entries;
}

/**
 * A rename takes a plain name, never a path: renaming must not become a way to move a file
 * between folders (that is `move`, and crossing a source boundary is a copy + delete there).
 */
export function assertPlainName(name: string): string {
  const value = String(name ?? "").trim();
  if (!value || value === "." || value === ".." || /[/\\]/.test(value)) {
    throw new WorkspaceError(
      "UNSUPPORTED",
      `"${name}" is not a file name. Pass a name without a slash.`,
    );
  }
  return value;
}

/** Resolves to null when the path does not exist; rethrows anything else. */
async function exists(
  provider: Pick<FileProvider, "stat">,
  path: string,
): Promise<boolean> {
  try {
    await provider.stat(path);
    return true;
  } catch (error) {
    if (error instanceof WorkspaceError && error.code === "NOT_FOUND") {
      return false;
    }
    throw error;
  }
}

/**
 * Renames `path` in place to `newName` and returns the new path. A provider with a native
 * `rename` uses it (saia-fs never overwrites); every other provider goes through `move`, whose
 * own implementations copy first and only then delete the source. A conflict is refused either
 * way — `move` on some backends would replace the destination.
 */
export async function renameProviderEntry(
  provider: Pick<FileProvider, "rename" | "move" | "stat">,
  path: string,
  newName: string,
): Promise<string> {
  const normalized = normalizePath(path);
  if (normalized === "/") {
    throw new WorkspaceError("PERMISSION_DENIED", "The root cannot be renamed");
  }
  const name = assertPlainName(newName);
  if (name === baseName(normalized)) return normalized;
  const target = joinPath(parentPath(normalized), name);
  if (provider.rename) {
    await provider.rename(normalized, name);
    return target;
  }
  if (!provider.move) throw new WorkspaceError("UNSUPPORTED", "rename");
  if (await exists(provider, target)) throw new WorkspaceError("CONFLICT", target);
  await provider.move(normalized, target);
  return target;
}

/**
 * Appends `data` to `path`, creating the file and its missing parents. A provider with a native
 * `append` uses it; otherwise the existing bytes are read and written back with the addition.
 */
export async function appendToProvider(
  provider: FileProvider,
  path: string,
  data: Uint8Array | string,
): Promise<string> {
  const normalized = normalizePath(path);
  if (provider.append && provider.capabilities.append !== false) {
    await provider.append(normalized, data);
    return normalized;
  }
  if (provider.capabilities.write === false) {
    throw new WorkspaceError("PERMISSION_DENIED", "Source is read-only");
  }
  const addition = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const present = await exists(provider, normalized);
  let bytes = addition;
  if (present) {
    const current = await readAll(await provider.read(normalized));
    bytes = new Uint8Array(current.length + addition.length);
    bytes.set(current, 0);
    bytes.set(addition, current.length);
  }
  const directory = parentPath(normalized);
  if (directory !== "/" && provider.capabilities.mkdir) {
    await provider.mkdir(directory).catch(() => {});
  }
  await provider.write(normalized, streamOf(bytes), { overwrite: true });
  return normalized;
}
