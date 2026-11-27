// The Arcana chat is ephemeral: it is not a conversation row.
//
// Keeping it out of Dexie means it cannot leak into the sidebar, the search, an
// export, a backup or the sync archive, and no schema change is needed. It
// lives in `sessionStorage`, so a reload keeps the thread and closing the tab
// drops it. Attachment bytes still go through the normal file store (they are
// referenced by id), which is what lets the upload tool read them.
import { getDefaultConversation } from "./conversationUtils";

const PREFIX = "chatai.arcana-chat:";

const keyFor = (collectionKey) => `${PREFIX}${collectionKey}`;

/** The conversation id used for this chat's file rows. */
export function arcanaChatConversationId(collectionKey) {
  return `arcana-chat:${collectionKey}`;
}

const isMessage = (value) =>
  value &&
  typeof value === "object" &&
  (value.role === "user" || value.role === "assistant" || value.role === "system") &&
  Array.isArray(value.content);

/**
 * A fresh thread: the usual system/user pair the chat shell expects, with the
 * Arcana's own id so attachments land in a stable file namespace.
 */
export function createArcanaChatState(collectionKey, userSettings, title) {
  const base = getDefaultConversation(userSettings, null);
  return {
    ...base,
    id: arcanaChatConversationId(collectionKey),
    title: title || "Arcana",
    messages: base.messages,
  };
}

/** Stored messages for a collection, or `null` when nothing was kept. */
export function loadArcanaChat(collectionKey) {
  try {
    const raw = sessionStorage.getItem(keyFor(collectionKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.messages)) return null;
    const messages = parsed.messages.filter(isMessage);
    if (messages.length < 2) return null;
    return {
      messages,
      settings: parsed.settings && typeof parsed.settings === "object"
        ? parsed.settings
        : undefined,
    };
  } catch {
    return null;
  }
}

/** Keep the thread for this tab. A storage failure must not break the chat. */
export function saveArcanaChat(collectionKey, { messages, settings }) {
  try {
    const rows = (messages ?? [])
      .filter(isMessage)
      // A loading flag from a tab that closed mid-answer would spin forever.
      .map(({ role, content, createdAt, meta, loading, ...rest }) => ({
        ...rest,
        role,
        content,
        ...(createdAt ? { createdAt } : {}),
        ...(meta ? { meta } : {}),
        ...(loading ? { loading: false } : {}),
      }));
    sessionStorage.setItem(
      keyFor(collectionKey),
      JSON.stringify({ messages: rows, settings }),
    );
  } catch {
    // Quota or a disabled store: the thread simply does not survive a reload.
  }
}

export function clearArcanaChat(collectionKey) {
  try {
    sessionStorage.removeItem(keyFor(collectionKey));
  } catch {
    // Nothing to do.
  }
}
