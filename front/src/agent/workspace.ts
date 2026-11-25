// One filesystem per conversation, stored in OPFS under "chats/<id>" (workspace/chatStorage.ts).
// Local folders picked by the user are mounted into it at "/local/<folder name>"; their handles
// are kept in IndexedDB, and permission is asked for again the first time the agent uses one.
import { HandleFs, MountFs, PermissionFs } from "./vfs";
import { deleteAllMounts, deleteMounts, getMounts, saveMount } from "../db/mounts";
import {
  chatStorageDir,
  chatStorageSize,
  copyChatStorage,
  deleteAllChatStorage,
  deleteChatStorage,
} from "../workspace/chatStorage";

const workspaces = new Map<string, MountFs>();

/**
 * Asks the user to grant access to a folder again. Set by the UI, because the browser only shows
 * its permission prompt in response to a click; resolves to whether access was granted.
 */
type AccessPrompt = (handle: FileSystemDirectoryHandle) => Promise<boolean>;
let accessPrompt: AccessPrompt | null = null;

export function setAccessPrompt(prompt: AccessPrompt | null) {
  accessPrompt = prompt;
}

const askAccess: AccessPrompt = async (handle) => (accessPrompt ? accessPrompt(handle) : false);

// Without this the browser may evict OPFS, and with it the agent's files, under storage pressure
let persistRequested = false;
function requestPersistence() {
  if (persistRequested) return;
  persistRequested = true;
  navigator.storage.persist?.().catch(() => {});
}

/** Bytes stored in this conversation's browser (OPFS) workspace. */
export async function getWorkspaceSize(conversationId: string): Promise<number> {
  return chatStorageSize(conversationId);
}

export async function getWorkspace(conversationId: string): Promise<MountFs> {
  let fs = workspaces.get(conversationId);
  if (!fs) {
    const dir = await chatStorageDir(conversationId);
    fs = new MountFs(new HandleFs(dir));
    for (const { path, handle } of await getMounts(conversationId)) fs.mount(path, new PermissionFs(handle, askAccess));
    workspaces.set(conversationId, fs);
    requestPersistence();
  }
  return fs;
}

export const canMountLocalDirectory = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

/**
 * Asks the user for a folder and mounts it read-write. The mount is kept with the conversation.
 * Returns the mount path, or null when the picker was cancelled.
 */
export async function mountLocalDirectory(conversationId: string): Promise<string | null> {
  let handle: FileSystemDirectoryHandle;
  try {
    handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
  } catch (error) {
    if ((error as Error).name === "AbortError") return null;
    throw error;
  }
  const at = `/local/${handle.name}`;
  (await getWorkspace(conversationId)).mount(at, new PermissionFs(handle, askAccess));
  await saveMount({ conversationId, path: at, handle });
  return at;
}

export function listMounts(conversationId: string): string[] {
  return [...(workspaces.get(conversationId)?.mounts.keys() ?? [])];
}

/** Copies a conversation's files and mounted folders to another one, for a fork. */
export async function copyWorkspace(fromId: string, toId: string) {
  await copyChatStorage(fromId, toId);
  for (const { path, handle } of await getMounts(fromId)) await saveMount({ conversationId: toId, path, handle });
}

export async function deleteWorkspace(conversationId: string) {
  workspaces.delete(conversationId);
  await deleteMounts(conversationId);
  await deleteChatStorage(conversationId);
}

export async function deleteAllWorkspaces() {
  workspaces.clear();
  await deleteAllMounts();
  await deleteAllChatStorage();
}
