const STORAGE_PREFIX = "chatai.agent-form-history";
const MAX_ENTRIES = 100;

const storageKey = (agentId, sessionId) =>
  `${STORAGE_PREFIX}:${agentId}:${sessionId}`;

const canStore = () => typeof localStorage !== "undefined";

const createdTime = (entry) => entry?.time?.created ?? 0;

const normalizeEntry = (entry) => {
  const form = entry?.form ?? {};
  const id = entry?.id ?? form.id;
  if (!id) return null;
  return {
    id,
    form,
    answers:
      entry.answers && typeof entry.answers === "object"
        ? entry.answers
        : undefined,
    time: {
      created: entry.time?.created ?? Date.now(),
      ...(entry.time?.submitted
        ? { submitted: entry.time.submitted }
        : {}),
    },
  };
};

export function loadAgentFormHistory(agentId, sessionId) {
  if (!canStore() || !agentId || !sessionId) return [];
  try {
    const raw = localStorage.getItem(storageKey(agentId, sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeEntry)
      .filter(Boolean)
      .sort((left, right) => createdTime(left) - createdTime(right));
  } catch {
    return [];
  }
}

export function saveAgentFormHistory(agentId, sessionId, entries) {
  if (!canStore() || !agentId || !sessionId) return;
  try {
    const normalized = entries
      .map(normalizeEntry)
      .filter(Boolean)
      .sort((left, right) => createdTime(left) - createdTime(right))
      .slice(-MAX_ENTRIES);
    localStorage.setItem(
      storageKey(agentId, sessionId),
      JSON.stringify(normalized),
    );
  } catch {}
}

export function clearAgentFormHistory(agentId) {
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
