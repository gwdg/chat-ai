// The prompts a user already sent to one agent session, recalled with ArrowUp/ArrowDown in the
// composer. It is deliberately per agent + session, like the draft: a new session is a new shell
// and starts with an empty history.
//
// Stored newest first, one JSON array per session, next to the drafts and the shell history in
// localStorage. A prompt that repeats the newest entry is not stored twice, so the second Up
// actually moves instead of returning the same text.
const STORAGE_PREFIX = "chatai.agent-prompt-history";

/** How many prompts one session keeps. Long enough to go back, short enough for localStorage. */
export const MAX_ENTRIES = 50;

const storageKey = (agentId, sessionId) =>
  `${STORAGE_PREFIX}:${agentId}:${sessionId}`;

const canStore = () => typeof localStorage !== "undefined";

/** A new list with `text` at the front, without a consecutive duplicate. */
export function addPromptEntry(entries, text) {
  const value = String(text ?? "").trim();
  if (!value) return entries;
  if (entries[0] === value) return entries;
  return [value, ...entries].slice(0, MAX_ENTRIES);
}

/**
 * Where one arrow-key press moves the cursor.
 *
 * `-1` is the draft the user was typing, `0` the most recent prompt and
 * `length - 1` the oldest. Up walks into the list and stops at the oldest, Down
 * walks back out to the draft and stops there — the way a shell behaves.
 *
 * @param {number} length entries in the history
 * @param {number} index current cursor
 * @param {-1 | 1} direction -1 for Up, 1 for Down
 */
export function nextHistoryIndex(length, index, direction) {
  if (!length) return -1;
  if (direction < 0) return index < 0 ? 0 : Math.min(index + 1, length - 1);
  if (index < 0) return -1;
  return index === 0 ? -1 : index - 1;
}

export function loadAgentPromptHistory(agentId, sessionId) {
  if (!canStore() || !agentId || !sessionId) return [];
  try {
    const raw = localStorage.getItem(storageKey(agentId, sessionId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((entry) => typeof entry === "string" && entry).slice(0, MAX_ENTRIES)
      : [];
  } catch {
    return [];
  }
}

/** Store a submitted prompt and return the list the composer should keep in memory. */
export function recordAgentPrompt(agentId, sessionId, text) {
  if (!canStore() || !agentId || !sessionId) return [];
  const entries = addPromptEntry(
    loadAgentPromptHistory(agentId, sessionId),
    text,
  );
  try {
    localStorage.setItem(storageKey(agentId, sessionId), JSON.stringify(entries));
  } catch {}
  return entries;
}

export function clearAgentPromptHistory(agentId, sessionId) {
  if (!canStore() || !agentId || !sessionId) return;
  try {
    localStorage.removeItem(storageKey(agentId, sessionId));
  } catch {}
}

/** Every session of one agent; used when the agent itself is removed. */
export function clearAgentPromptHistories(agentId) {
  if (!canStore() || !agentId) return;
  const prefix = `${STORAGE_PREFIX}:${agentId}:`;
  try {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {}
}
