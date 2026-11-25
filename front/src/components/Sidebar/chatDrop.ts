import { assignConversationToFolder } from "../../db";
import { attachWorkspaceChat, detachWorkspaceChat } from "../../db/workspaceDb";

// A dragged chat carries its id under a private type, so a workspace row only
// accepts the sidebar's own chat drags — not files, text or a browser tab.
export const CHAT_DRAG_MIME = "application/x-chatai-chat";
// Present only when the row was dragged out of a workspace and holds that
// workspace's id. Dropping it on a topic or another workspace takes it out.
export const CHAT_SOURCE_WORKSPACE_MIME = "application/x-chatai-chat-workspace";

export function setChatDragData(
  dataTransfer: DataTransfer | null,
  conversationId: string,
  workspaceId: string | null = null,
) {
  if (!dataTransfer) return;
  // text/plain keeps the id readable for generic handlers; the private types
  // decide who lights up as a drop target.
  dataTransfer.setData("text/plain", conversationId);
  dataTransfer.setData(CHAT_DRAG_MIME, conversationId);
  if (workspaceId) dataTransfer.setData(CHAT_SOURCE_WORKSPACE_MIME, workspaceId);
  dataTransfer.effectAllowed = "move";
}

export function isChatDrag(dataTransfer: DataTransfer | null): boolean {
  const types = dataTransfer?.types;
  if (!types) return false;
  return Array.prototype.includes.call(types, CHAT_DRAG_MIME);
}

export function readChatDrag(
  dataTransfer: DataTransfer | null,
): { conversationId: string; workspaceId: string | null } | null {
  if (!dataTransfer) return null;
  const conversationId =
    dataTransfer.getData(CHAT_DRAG_MIME) || dataTransfer.getData("text/plain");
  if (!conversationId) return null;
  return {
    conversationId,
    workspaceId: dataTransfer.getData(CHAT_SOURCE_WORKSPACE_MIME) || null,
  };
}

/**
 * Dropping a chat on a topic. A row dragged out of a workspace is detached from
 * it even when the chat already lives in that topic, so "drag out" always
 * removes the attachment.
 */
export async function dropConversationOnTopic({
  conversationId,
  currentFolderId,
  targetFolderId,
  sourceWorkspaceId,
}: {
  conversationId: string;
  currentFolderId: string | null;
  targetFolderId: string | null;
  sourceWorkspaceId?: string | null;
}) {
  if (sourceWorkspaceId) {
    await detachWorkspaceChat(sourceWorkspaceId, conversationId);
  }
  if ((currentFolderId ?? null) !== (targetFolderId ?? null)) {
    await assignConversationToFolder(conversationId, targetFolderId);
  }
}

/**
 * Dropping a chat on a workspace row attaches it. A row dragged out of another
 * workspace moves with it; adding a chat to an additional workspace is done by
 * dragging the chat's own topic row.
 */
export async function dropConversationOnWorkspace({
  conversationId,
  targetWorkspaceId,
  sourceWorkspaceId,
}: {
  conversationId: string;
  targetWorkspaceId: string;
  sourceWorkspaceId?: string | null;
}) {
  if (sourceWorkspaceId && sourceWorkspaceId !== targetWorkspaceId) {
    await detachWorkspaceChat(sourceWorkspaceId, conversationId);
  }
  await attachWorkspaceChat(targetWorkspaceId, conversationId);
}
