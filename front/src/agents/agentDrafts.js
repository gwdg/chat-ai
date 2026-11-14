const STORAGE_PREFIX = "chatai.agent-draft";

const storageKey = (agentId, sessionId) =>
  `${STORAGE_PREFIX}:${agentId}:${sessionId}`;

const canStore = () => typeof localStorage !== "undefined";

export function loadAgentDraft(agentId, sessionId) {
  if (!canStore() || !agentId || !sessionId) return "";
  try {
    return localStorage.getItem(storageKey(agentId, sessionId)) ?? "";
  } catch {
    return "";
  }
}

export function saveAgentDraft(agentId, sessionId, text) {
  if (!canStore() || !agentId || !sessionId) return;
  try {
    const key = storageKey(agentId, sessionId);
    if (text) localStorage.setItem(key, text);
    else localStorage.removeItem(key);
  } catch {}
}

export function clearAgentDraft(agentId, sessionId) {
  if (!canStore() || !agentId || !sessionId) return;
  try {
    localStorage.removeItem(storageKey(agentId, sessionId));
  } catch {}
}

export function clearAgentDrafts(agentId) {
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
