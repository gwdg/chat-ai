// A workspace file changed under the tree's feet — the agent wrote, created or removed one.
// The tree listens for this and re-lists, so the sidebar follows the model without a manual
// refresh and without a poll.
export const WORKSPACE_FILES_CHANGED_EVENT = "chatai:workspace-files-changed";

export function notifyWorkspaceFilesChanged(workspaceId?: string) {
  if (typeof window === "undefined" || !workspaceId) return;
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_FILES_CHANGED_EVENT, {
      detail: { workspaceId },
    }),
  );
}
