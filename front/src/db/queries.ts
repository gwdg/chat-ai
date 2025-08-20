import { useLiveQuery } from "dexie-react-hooks";

import type { ModelSpec } from './dbTypes'
import { db } from './index'

export async function setConversationModelDB(
  conversationId: string,
  newModel: ModelSpec
): Promise<boolean> {
  const updated = await db.conversations
    .where('id')
    .equals(conversationId)
    .modify(conv => {
      // assumes settings exists; if you want to be extra defensive, init it.
      conv.settings.model = newModel;
    });
  return updated > 0;
}

export function useConversationDB(conversationId) {
  return useLiveQuery(() => (conversationId ? db.conversations.get(conversationId) : undefined), [conversationId]);
}

export function useConversationModelDB(conversationId): ModelSpec | undefined {
  return useLiveQuery(async () => {
    if (!conversationId) return undefined;
    const conv = await db.conversations.get(conversationId);
    return conv?.settings?.model; // primitive string or undefined
  }, [conversationId]);
}
