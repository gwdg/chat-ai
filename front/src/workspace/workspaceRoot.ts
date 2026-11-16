import { BrowserProvider } from "./providers/browser";
import { workspaceBrowserStorageId } from "./browserStorage";

export const workspaceRootSourceId = (workspaceId: string) =>
  `workspace-root:${workspaceId}`;

export function createWorkspaceRootProvider(workspaceId: string): BrowserProvider {
  return new BrowserProvider(
    workspaceRootSourceId(workspaceId),
    workspaceBrowserStorageId(workspaceId),
  );
}

export const emptyStream = (): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });

export type RootEntry = import("../db/dbTypes").WorkspaceFileEntry & {
  local: boolean;
  mount?: import("../db/dbTypes").WorkspaceMountRow;
  /** Shown instead of the folder name, e.g. a chat title for `/chats/<conversation id>`. */
  label?: string;
};
