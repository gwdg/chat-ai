import { isWithinPath, normalizePath } from "./paths";

export type MountLike = { sourceId: string; sourcePath: string };

export type SelectionLike = { sourceId: string; path: string };

/**
 * True when a mount of the same source is the selected path or sits above it.
 *
 * Comparison is segment-aware, so `/notes` covers `/notes` and `/notes/a.txt`
 * but never `/notes2`. A root mount (`/`) covers every path of its source.
 */
export const mountCoversSelection = (
  mounts: MountLike[],
  selection: SelectionLike,
): boolean => {
  const selectionPath = normalizePath(selection.path);
  return mounts.some(
    (mount) =>
      mount.sourceId === selection.sourceId &&
      isWithinPath(selectionPath, mount.sourcePath),
  );
};

const REGEXP_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

const escapeRegExp = (value: string): string =>
  value.replace(REGEXP_METACHARACTERS, "\\$&");

/**
 * True when the workspace root already contains `name`, including the numbered
 * collision copies created when copying into an occupied root: `notes.txt`
 * matches `notes (2).txt` / `notes (12).txt`, and a folder `notes` matches
 * `notes (2)`.
 *
 * The base name is split at its last dot exactly like `findAvailableName` in
 * `transfer.ts` (only when the dot is not the first character), so the suffix
 * goes before a file extension but after a folder name. Regex metacharacters
 * in the base name are escaped and matched literally.
 */
export const rootHasName = (names: Iterable<string>, name: string): boolean => {
  if (!name) return false;
  const extensionAt = name.lastIndexOf(".");
  const stem = extensionAt > 0 ? name.slice(0, extensionAt) : name;
  const extension = extensionAt > 0 ? name.slice(extensionAt) : "";
  const matcher = new RegExp(
    `^${escapeRegExp(stem)}(?: \\(\\d+\\))?${escapeRegExp(extension)}$`,
  );
  for (const candidate of names) {
    if (matcher.test(candidate)) return true;
  }
  return false;
};
