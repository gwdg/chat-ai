import type { WorkspaceSourceRow } from "../db/dbTypes";

/**
 * Sources shown under "Available storage".
 *
 * A chat's storage source is derived from the workspace's attached chats and
 * appears as a `/chats/<conversation id>` folder, so it is not storage the user
 * added and must not be listed next to browser, local, Arcana or MCP sources.
 */
export function visibleStorageSources(
  sources: WorkspaceSourceRow[],
): WorkspaceSourceRow[] {
  return sources.filter((source) => source.kind !== "chat");
}
