import { db } from "../db";
import { createProvider } from "./providers";
import { createWorkspaceRootProvider } from "./workspaceRoot";
import type { WorkspaceMountRow } from "../db/dbTypes";
import type { FileProvider } from "./providers/types";

export type ChatWorkspaceBundle = {
  workspaceId: string;
  root: ReturnType<typeof createWorkspaceRootProvider>;
  mounts: { mount: WorkspaceMountRow; provider: FileProvider }[];
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

  const root = createWorkspaceRootProvider(link.workspaceId);
  await root.connect().catch(() => {});

  const sources = await db.workspace_sources
    .where("workspaceId")
    .equals(link.workspaceId)
    .toArray();
  const mountRows = await db.workspace_mounts
    .where("workspaceId")
    .equals(link.workspaceId)
    .toArray();
  const mounts: ChatWorkspaceBundle["mounts"] = [];
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
  return { workspaceId: link.workspaceId, root, mounts };
}
