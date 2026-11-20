// A workspace file changed under the tree's feet — the agent wrote, created or removed one.
// The tree listens for this and re-lists, so the sidebar follows the model without a manual
// refresh and without a poll. The path and kind let it mark the row that changed.
export const WORKSPACE_FILES_CHANGED_EVENT = "chatai:workspace-files-changed";

export type WorkspaceFileChangeKind = "create" | "modify" | "remove";

export type WorkspaceFileChange = {
  workspaceId: string;
  /** Workspace-space path, e.g. "/Docs/report.md". */
  path?: string;
  kind?: WorkspaceFileChangeKind;
};

export function notifyWorkspaceFilesChanged(
  workspaceId?: string,
  change: { path?: string; kind?: WorkspaceFileChangeKind } = {},
) {
  if (typeof window === "undefined" || !workspaceId) return;
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_FILES_CHANGED_EVENT, {
      detail: { workspaceId, ...change },
    }),
  );
}
