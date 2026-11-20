/**
 * The IndexedDB tree every browser source and workspace root shared before
 * Dexie v16. Only the v11 migration and the v16 upgrade refer to it now; new
 * data never goes here.
 */
export const SHARED_BROWSER_STORAGE_ID = "browser-storage";

/**
 * One IndexedDB tree per workspace: the workspace root and all of its browser
 * sources use this id, so a workspace never sees another workspace's files.
 */
export const workspaceBrowserStorageId = (workspaceId: string) =>
  `workspace-browser:${workspaceId}`;
