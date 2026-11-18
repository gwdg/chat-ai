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

export type SourceRowActions = {
  addFolder: boolean;
  toggleReadOnly: boolean;
  remove: boolean;
};

type SourceForActions = Pick<WorkspaceSourceRow, "kind" | "readOnly">;

/**
 * Which actions a source row in "Available storage" offers.
 *
 * The browser source is the workspace's own tree, and it exists once, for as long as the
 * workspace does (`ensureBrowserSource` only runs at creation), so:
 * - "remove" would be permanent: nothing in the UI recreates the row, and its mounts go with it;
 * - "add folder" would mount a folder that is already at the workspace root, which
 *   `mountTarget.ts` refuses;
 * - "read only" never reaches the root provider, so it would label the row read-only while the
 *   workspace root keeps allowing writes to the same files.
 *
 * Agent and chat sources are derived rather than added: a chat's folder belongs to the chat, and
 * an agent's filesystem is remote read-only storage, so neither is removable or switchable here.
 */
export function sourceRowActions({
  kind,
  readOnly,
}: SourceForActions): SourceRowActions {
  if (kind === "browser") {
    return {
      addFolder: false,
      // A row switched to read-only before this rule existed keeps its way back.
      toggleReadOnly: readOnly === true,
      remove: false,
    };
  }
  if (kind === "chat" || kind === "agent") {
    return { addFolder: kind === "agent", toggleReadOnly: false, remove: false };
  }
  return { addFolder: true, toggleReadOnly: true, remove: true };
}
