import { BrowserProvider } from "./providers/browser";

export const workspaceRootSourceId = (workspaceId: string) =>
  `workspace-root:${workspaceId}`;

export function createWorkspaceRootProvider(workspaceId: string): BrowserProvider {
  return new BrowserProvider(workspaceRootSourceId(workspaceId));
}

export const emptyStream = (): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
