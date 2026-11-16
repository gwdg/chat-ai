// Every chat owns one browser (OPFS) tree at `chats/<conversationId>`. It belongs to the chat and
// not to a workspace: attaching the chat to a workspace only links this tree in at
// `/chats/<conversationId>` (see db/workspaceDb.ts#ensureChatStorageSource), detaching removes the
// link and leaves the files where they are.
//
// The tree used to be `conversations/<id>`. The first access moves it, so existing chats keep
// their files without a migration step that has to run at startup.
const CHATS_DIR = "chats";
const LEGACY_CHATS_DIR = "conversations";

// The workspace source and mount that link a chat's tree in while the chat is attached. The path
// is derived from the conversation id, so it stays stable across renames.
const CHAT_STORAGE_SOURCE_PREFIX = "chat-storage:";

export const chatStorageSourceId = (
  workspaceId: string,
  conversationId: string,
) => `${CHAT_STORAGE_SOURCE_PREFIX}${workspaceId}:${conversationId}`;

/** Where an attached chat's own folder shows up inside the workspace. */
export const chatStorageMountPath = (conversationId: string) =>
  `/chats/${conversationId}`;

const opfsRoot = () => navigator.storage.getDirectory();

const findDir = async (
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle | null> => {
  try {
    return await parent.getDirectoryHandle(name);
  } catch {
    return null;
  }
};

const chatsRoot = async (create: boolean): Promise<FileSystemDirectoryHandle> => {
  const opfs = await opfsRoot();
  if (create) return opfs.getDirectoryHandle(CHATS_DIR, { create: true });
  const dir = await findDir(opfs, CHATS_DIR);
  if (!dir) throw new DOMException("No chat storage", "NotFoundError");
  return dir;
};

const legacyChatDir = async (
  conversationId: string,
): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const legacy = await findDir(await opfsRoot(), LEGACY_CHATS_DIR);
    return legacy ? await findDir(legacy, conversationId) : null;
  } catch {
    return null;
  }
};

const removeLegacyChatDir = async (conversationId: string) => {
  try {
    const legacy = await findDir(await opfsRoot(), LEGACY_CHATS_DIR);
    await legacy?.removeEntry(conversationId, { recursive: true });
  } catch {
    // Already gone, or still in use by another tab
  }
};

async function copyDirectory(
  from: FileSystemDirectoryHandle,
  to: FileSystemDirectoryHandle,
): Promise<void> {
  // @ts-expect-error entries() is missing from older DOM typings
  for await (const [name, handle] of from.entries()) {
    if (handle.kind === "directory") {
      await copyDirectory(
        handle,
        await to.getDirectoryHandle(name, { create: true }),
      );
      continue;
    }
    const writable = await (
      await to.getFileHandle(name, { create: true })
    ).createWritable();
    try {
      await writable.write(await handle.getFile());
    } finally {
      await writable.close();
    }
  }
}

async function directorySize(dir: FileSystemDirectoryHandle): Promise<number> {
  let total = 0;
  // @ts-expect-error entries() is missing from older DOM typings
  for await (const [, handle] of dir.entries()) {
    if (handle.kind === "file") total += (await handle.getFile()).size;
    else total += await directorySize(handle);
  }
  return total;
}

/** The chat's own tree, created on first use; a pre-`chats` tree is moved in once. */
export async function chatStorageDir(
  conversationId: string,
): Promise<FileSystemDirectoryHandle> {
  const chats = await chatsRoot(true);
  const existing = await findDir(chats, conversationId);
  if (existing) return existing;
  const dir = await chats.getDirectoryHandle(conversationId, { create: true });
  const legacy = await legacyChatDir(conversationId);
  if (legacy) {
    await copyDirectory(legacy, dir);
    await removeLegacyChatDir(conversationId);
  }
  return dir;
}

/** Bytes in a chat's own tree, whether it still sits at the old path or the new one. */
export async function chatStorageSize(conversationId: string): Promise<number> {
  try {
    const chats = await chatsRoot(false);
    const dir = await findDir(chats, conversationId);
    if (dir) return await directorySize(dir);
  } catch {
    // No `chats` tree yet, fall through to the legacy location
  }
  try {
    const legacy = await legacyChatDir(conversationId);
    return legacy ? await directorySize(legacy) : 0;
  } catch {
    return 0;
  }
}

/** Copies a chat's files to another chat, for a fork. */
export async function copyChatStorage(
  fromId: string,
  toId: string,
): Promise<void> {
  let from: FileSystemDirectoryHandle | null = null;
  try {
    from = await findDir(await chatsRoot(false), fromId);
  } catch {
    // no `chats` tree yet
  }
  from ??= await legacyChatDir(fromId);
  if (!from) return;
  const to = await (await chatsRoot(true)).getDirectoryHandle(toId, {
    create: true,
  });
  await copyDirectory(from, to);
}

export async function deleteChatStorage(conversationId: string): Promise<void> {
  try {
    const chats = await chatsRoot(false);
    await chats.removeEntry(conversationId, { recursive: true });
  } catch {
    // never created
  }
  await removeLegacyChatDir(conversationId);
}

/** Drops every chat tree, for a database reset. */
export async function deleteAllChatStorage(): Promise<void> {
  const opfs = await opfsRoot();
  for (const name of [CHATS_DIR, LEGACY_CHATS_DIR]) {
    try {
      await opfs.removeEntry(name, { recursive: true });
    } catch {
      // never created
    }
  }
}
