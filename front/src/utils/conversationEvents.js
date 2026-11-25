// A conversation's topic is owned by the sidebar (drag and drop, "Move to
// topic", the organizer, a Meta-chat proposal), never by the chat page's own
// autosave. Moving bumps `lastModified`, so the open conversation has to adopt
// that value: otherwise its next autosave looks stale and reports a conflict
// ("changed by another tab"), and the overwrite offered there would write the
// old topic back.
export const CONVERSATION_MOVED_EVENT = "chatai:conversation-moved";

export function notifyConversationMoved({ conversationId, folderId, lastModified }) {
  if (typeof window === "undefined" || !conversationId) return;
  window.dispatchEvent(
    new CustomEvent(CONVERSATION_MOVED_EVENT, {
      detail: {
        conversationId,
        folderId: folderId ?? null,
        lastModified: lastModified ?? Date.now(),
      },
    }),
  );
}
