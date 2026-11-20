import {
  addSource,
  addWorkspaceMount,
  createWorkspace,
} from "../db/workspaceDb";
import { defaultCapabilities } from "./capabilities";
import { folderName } from "./folders";

type PickDirectoryOptions = {
  mode?: "read" | "readwrite";
  unsupportedMessage: string;
  insecureMessage?: string;
  onPickerError?: (event: unknown) => void;
};

/** Opens the browser directory picker. Callers keep their own wording for why it is unavailable. */
export async function pickDirectory({
  mode = "readwrite",
  unsupportedMessage,
  insecureMessage,
  onPickerError,
}: PickDirectoryOptions): Promise<FileSystemDirectoryHandle> {
  if (insecureMessage && window.isSecureContext === false) {
    throw new Error(insecureMessage);
  }
  if (!("showDirectoryPicker" in window)) {
    throw new Error(unsupportedMessage);
  }
  try {
    return await (
      window as unknown as {
        showDirectoryPicker: (options: {
          mode: "read" | "readwrite";
        }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker({ mode });
  } catch (event) {
    onPickerError?.(event);
    throw event;
  }
}

type AddLocalSourceInput = {
  workspaceId: string;
  handle: FileSystemDirectoryHandle;
  label?: string;
  readOnly?: boolean;
};

export async function addLocalSource({
  workspaceId,
  handle,
  label = handle.name,
  readOnly = false,
}: AddLocalSourceInput): Promise<string> {
  return addSource({
    workspaceId,
    kind: "local",
    label,
    config: { handleKey: "", folderName: handle.name },
    capabilities: defaultCapabilities("local"),
    status: "offline",
    readOnly,
    handle,
  });
}

type CreateLocalWorkspaceInput = {
  name: string;
  handle: FileSystemDirectoryHandle;
};

/**
 * Creates a workspace around a picked directory: the folder becomes a local source and is mounted
 * at the workspace root under its own name.
 */
export async function createLocalWorkspace({
  name,
  handle,
}: CreateLocalWorkspaceInput): Promise<{
  workspaceId: string;
  sourceId: string;
  mountPath: string;
}> {
  const workspaceId = await createWorkspace(name);
  const sourceId = await addLocalSource({ workspaceId, handle });
  const mountPath = `/${folderName(handle.name, {
    maxLength: 120,
    rejectEmpty: true,
  })}`;
  await addWorkspaceMount({
    workspaceId,
    sourceId,
    sourcePath: "/",
    path: mountPath,
  });
  return { workspaceId, sourceId, mountPath };
}
