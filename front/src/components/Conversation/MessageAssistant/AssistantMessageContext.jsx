import { createContext, useContext } from "react";

/**
 * The assistant message a rendered markdown fence belongs to.
 *
 * A fence component only receives its own source text, so state that belongs
 * to one message (the course quiz keeps the answer the user gave) is reached
 * through this context instead of through new renderer props. It is generic on
 * purpose: a brand feature must not have to change the markdown renderer to
 * keep something next to its fence.
 *
 * `getMessage()` reads the current message, `setMessageMeta(patch)` merges a
 * top-level patch into `message.meta` (it accepts an updater function) and goes
 * through the same debounced autosave as every other conversation change.
 * `meta` is persisted with the message row, so it survives a reload and sync.
 */
export const AssistantMessageContext = createContext(null);

export const useAssistantMessage = () => useContext(AssistantMessageContext);

/**
 * Where the open message sits in a message list.
 *
 * A message streamed in this tab has no `id` yet: the store hands it one when
 * it writes the row, and the next save can hand it another one. So the id is
 * the identity when there is one (the message was loaded from the database)
 * and the position in the list is the identity while the turn is still live.
 * Without the fallback, anything a fence stores on the message is dropped for
 * the assistant reply that is currently on screen.
 */
export function resolveMessageIndex(messages, { messageId, fallbackIndex } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  if (messageId != null) {
    return list.findIndex((item) => item?.id === messageId);
  }
  const index = Number(fallbackIndex);
  return Number.isInteger(index) && index >= 0 && list[index] ? index : -1;
}
