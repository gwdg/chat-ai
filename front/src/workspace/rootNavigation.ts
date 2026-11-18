import { parentPath } from "./paths";
import type { RootEntry } from "./workspaceRoot";

export type RootEntryAction =
  | { kind: "mount"; mount: NonNullable<RootEntry["mount"]> }
  | { kind: "folder"; path: string }
  | { kind: "file"; folder: string; path: string };

/**
 * What a row of the left "Workspace root" list opens in the centre browser: the
 * mounted source, the folder itself, or the folder of a file whose preview is
 * shown next to the browser.
 */
export function rootEntryAction(
  entry: Pick<RootEntry, "kind" | "path" | "mount">,
): RootEntryAction {
  if (entry.mount) return { kind: "mount", mount: entry.mount };
  if (entry.kind === "dir") return { kind: "folder", path: entry.path };
  return { kind: "file", folder: parentPath(entry.path), path: entry.path };
}
