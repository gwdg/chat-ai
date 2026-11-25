import {
  addSource,
  addWorkspaceMount,
  createWorkspace,
  listWorkspaceMounts,
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

/**
 * Mounts a source at the workspace root under its folder name, stepping aside
 * to "Name (2)" if a mount already holds that path.
 */
export async function mountLocalSourceAtRoot({
  workspaceId,
  sourceId,
  name,
  readOnly = false,
}: {
  workspaceId: string;
  sourceId: string;
  name: string;
  readOnly?: boolean;
}): Promise<string> {
  const base = `/${folderName(name, {
    maxLength: 120,
    rejectEmpty: true,
  })}`;
  const taken = new Set<string>();
  try {
    for (const mount of await listWorkspaceMounts([workspaceId])) {
      taken.add(mount.path);
    }
  } catch {
    // Without the mount list, only this call's own path is protected.
  }
  let mountPath = base;
  for (let suffix = 2; taken.has(mountPath); suffix += 1) {
    mountPath = `${base} (${suffix})`;
  }
  await addWorkspaceMount({
    workspaceId,
    sourceId,
    sourcePath: "/",
    path: mountPath,
    readOnly,
  });
  return mountPath;
}

/**
 * Adding a folder from this device puts it in the workspace too: the source is
 * created and mounted at the root, so it shows up in the tree without a second
 * "Add to workspace" step.
 */
export async function addLocalSourceToWorkspace({
  workspaceId,
  handle,
  label,
  readOnly = false,
}: AddLocalSourceInput): Promise<{ sourceId: string; mountPath: string }> {
  const sourceId = await addLocalSource({
    workspaceId,
    handle,
    label,
    readOnly,
  });
  const mountPath = await mountLocalSourceAtRoot({
    workspaceId,
    sourceId,
    name: handle.name,
    readOnly,
  });
  return { sourceId, mountPath };
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
  const { sourceId, mountPath } = await addLocalSourceToWorkspace({
    workspaceId,
    handle,
  });
  return { workspaceId, sourceId, mountPath };
}
