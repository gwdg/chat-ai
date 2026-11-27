import { createConversation } from "../db";
import { createAttachedChat } from "../db/workspaceDb";

export type NewChatTarget = {
  id: string;
  /** True when the chat was linked to a workspace while it was created. */
  attached: boolean;
};

/**
 * Creates the chat "New chat" starts in.
 *
 * A selected workspace wins: the chat is linked to it in the same step, the way
 * the workspace row's "+" does it, so it does not land under "Unsorted chats"
 * as an unassigned chat. Without a workspace the call keeps the old behaviour.
 */
export async function createNewChatConversation(
  workspaceId: string | null,
  conversation: Parameters<typeof createConversation>[0],
): Promise<NewChatTarget> {
  if (!workspaceId) {
    return { id: await createConversation(conversation), attached: false };
  }
  return {
    id: await createAttachedChat(workspaceId, conversation),
    attached: true,
  };
}
