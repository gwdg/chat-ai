import { db } from "../db";
import { createProvider } from "./providers";
import { createWorkspaceRootProvider } from "./workspaceRoot";
import { ensureChatStorageSource } from "../db/workspaceDb";
import type { WorkspaceMountRow } from "../db/dbTypes";
import type { FileProvider } from "./providers/types";

export type ChatWorkspaceBundle = {
  workspaceId: string;
  root: ReturnType<typeof createWorkspaceRootProvider>;
  mounts: { mount: WorkspaceMountRow; provider: FileProvider }[];
  close: () => void;
};

export async function getChatWorkspaceBundle(
  conversationId: string,
): Promise<ChatWorkspaceBundle | null> {
  const links = await db.workspace_chats
    .where("conversationId")
    .equals(conversationId)
    .toArray();
  if (!links.length) return null;
  const link = links.sort((a, b) => a.createdAt - b.createdAt)[0];
  const workspace = await db.workspaces.get(link.workspaceId);
  if (!workspace) return null;

  // The chat's own tree is linked in here, not copied. Re-check on every turn so a workspace that
  // was created before the chat was attached still shows it; when both already exist this writes
  // nothing.
  const title = (await db.conversations.get(conversationId))?.title;
  await ensureChatStorageSource(link.workspaceId, conversationId, title).catch(
    () => {},
  );

  const root = createWorkspaceRootProvider(link.workspaceId);
  await root.connect().catch(() => {});

  const mounts: ChatWorkspaceBundle["mounts"] = [];
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      root.close?.();
    } catch {}
    for (const { provider } of mounts) {
      try {
        provider.close?.();
      } catch {}
    }
  };

  try {
    const sources = await db.workspace_sources
      .where("workspaceId")
      .equals(link.workspaceId)
      .toArray();
    const mountRows = await db.workspace_mounts
      .where("workspaceId")
      .equals(link.workspaceId)
      .toArray();
    for (const mount of mountRows) {
      const source = sources.find((candidate) => candidate.id === mount.sourceId);
      if (!source) continue;
      const provider = createProvider(source);
      try {
        await provider.connect();
        mounts.push({ mount, provider });
      } catch {
        provider.close?.();
      }
    }
  } catch (error) {
    close();
    throw error;
  }

  return { workspaceId: link.workspaceId, root, mounts, close };
}
