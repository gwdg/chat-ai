import { BrowserProvider } from "./providers/browser";
import { SHARED_BROWSER_STORAGE_ID } from "./browserStorage";

export const workspaceRootSourceId = (workspaceId: string) =>
  `workspace-root:${workspaceId}`;

export function createWorkspaceRootProvider(workspaceId: string): BrowserProvider {
  return new BrowserProvider(
    workspaceRootSourceId(workspaceId),
    SHARED_BROWSER_STORAGE_ID,
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
};
