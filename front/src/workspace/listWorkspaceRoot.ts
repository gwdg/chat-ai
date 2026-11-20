import type { WorkspaceMountRow } from "../db/dbTypes";
import type { FileProvider } from "./providers/types";
import { joinPath, normalizePath } from "./paths";
import { workspaceRootSourceId, type RootEntry } from "./workspaceRoot";

export async function listWorkspaceRoot(args: {
  rootProvider: FileProvider | null;
  workspaceId: string;
  mounts: WorkspaceMountRow[];
  path: string;
}): Promise<RootEntry[]> {
  const { rootProvider, workspaceId, mounts, path } = args;
  if (!rootProvider || !workspaceId) return [];
  await rootProvider.connect();
  const page = await rootProvider.list(path);
  const local: RootEntry[] = page.entries.map((entry) => ({
    ...entry,
    local: true,
  }));
  const prefix = path === "/" ? "/" : `${path}/`;
  const virtual = new Map<string, RootEntry>();
  for (const mount of mounts) {
    const mountPath = normalizePath(mount.path);
    if (mountPath === path || !mountPath.startsWith(prefix)) continue;
    const rest = mountPath.slice(prefix.length);
    const first = rest.split("/")[0];
    if (!first || local.some((entry) => entry.name === first)) continue;
    const entryPath = joinPath(path, first);
    if (virtual.has(first)) continue;
    virtual.set(first, {
      sourceId: workspaceRootSourceId(workspaceId),
      path: entryPath,
      name: first,
      kind: "dir",
      local: false,
      mount: mountPath === entryPath ? mount : undefined,
    });
  }
  // Attached chats always live under `/chats`. The directory is display-only:
  // it exists even when no chat is attached, and opening it lists the chat
  // mounts (or nothing) exactly like a mount-backed folder.
  if (
    path === "/" &&
    !local.some((entry) => entry.name === "chats") &&
    !virtual.has("chats")
  ) {
    virtual.set("chats", {
      sourceId: workspaceRootSourceId(workspaceId),
      path: "/chats",
      name: "chats",
      kind: "dir",
      local: false,
    });
  }
  return [...local, ...virtual.values()];
}
