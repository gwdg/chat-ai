/**
 * Where the feedback receiver stands for one conversation.
 *
 * The app sends chat transcripts as a delta: only the turns added since its
 * last submission, and the receiver appends them to the row it already stores.
 * That only works while the beginning of the transcript is unchanged, so the
 * cursor keeps both the number of messages that were sent and a hash of them:
 * a chat that was edited, reverted or trimmed at the front no longer matches
 * and the next submission carries the whole transcript again.
 *
 * This is display state, not user data: it lives in `localStorage` so a reload
 * does not resend everything, and losing it only costs one full submission.
 */

const STORAGE_KEY = "chatai.feedback.cursors.v1";
const MAX_ENTRIES = 200;

const storage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // A browser that blocks storage access throws on the property read.
    return null;
  }
};

const readAll = () => {
  const local = storage();
  if (!local) return {};
  try {
    const parsed = JSON.parse(local.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
};

const writeAll = (cursors) => {
  const local = storage();
  if (!local) return;
  try {
    local.setItem(STORAGE_KEY, JSON.stringify(cursors));
  } catch {
    // A full quota only means the next submission is a full transcript.
  }
};

const isCursor = (value) =>
  value &&
  typeof value === "object" &&
  Number.isInteger(value.count) &&
  value.count >= 0 &&
  typeof value.hash === "string";

/** FNV-1a over the serialized messages: short, stable, and only used locally. */
export const transcriptHash = (messages) => {
  const text = JSON.stringify(Array.isArray(messages) ? messages : []);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

/** The stored cursor for a conversation, or `null` when it has none. */
export const readFeedbackCursor = (conversationId) => {
  if (!conversationId) return null;
  const cursor = readAll()[conversationId];
  return isCursor(cursor)
    ? { count: cursor.count, hash: cursor.hash }
    : null;
};

export const writeFeedbackCursor = (conversationId, cursor) => {
  if (!conversationId) return;
  const all = readAll();
  all[conversationId] = {
    count: Math.max(0, Math.trunc(Number(cursor?.count) || 0)),
    hash: String(cursor?.hash ?? ""),
    at: Date.now(),
  };
  const keys = Object.keys(all);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((first, second) => (all[first].at ?? 0) - (all[second].at ?? 0))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((key) => delete all[key]);
  }
  writeAll(all);
};

export const clearFeedbackCursor = (conversationId) => {
  if (!conversationId) return;
  const all = readAll();
  if (!(conversationId in all)) return;
  delete all[conversationId];
  writeAll(all);
};

/** The turns after the stored cursor, or `null` when the transcript diverged. */
export const feedbackDelta = (messages, cursor) => {
  if (!cursor || cursor.count <= 0 || cursor.count > messages.length) {
    return null;
  }
  const prefix = messages.slice(0, cursor.count);
  return transcriptHash(prefix) === cursor.hash
    ? messages.slice(cursor.count)
    : null;
};
