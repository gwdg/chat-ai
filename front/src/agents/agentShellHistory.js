const STORAGE_PREFIX = "chatai.agent-shell-history";
const MAX_ENTRIES = 100;
const MAX_OUTPUT_CHARS = 20000;

const storageKey = (agentId, sessionId) =>
  `${STORAGE_PREFIX}:${agentId}:${sessionId}`;

const canStore = () => typeof localStorage !== "undefined";

const messageTime = (message) =>
  message?.time?.created ?? message?.time?.completed ?? 0;

const trimShell = (message, settleRunning = false) => {
  let output = message.output;
  if (
    output &&
    typeof output.output === "string" &&
    output.output.length > MAX_OUTPUT_CHARS
  ) {
    output = {
      ...output,
      output: `…\n${output.output.slice(-MAX_OUTPUT_CHARS)}`,
    };
  }
  return {
    id: message.id ?? `shell:${message.shellID}`,
    type: "shell",
    shellID: message.shellID,
    command: message.command ?? "",
    status:
      settleRunning && message.status === "running"
        ? "exited"
        : (message.status ?? "exited"),
    aborted: message.aborted === true,
    exit: message.exit,
    output,
    time: message.time,
  };
};

export function mergeAgentMessages(messages, shells) {
  const shellMap =
    shells instanceof Map
      ? new Map(shells)
      : new Map((shells ?? []).map((message) => [message.shellID, message]));
  for (const message of messages) {
    if (message.type !== "shell") continue;
    const existing = shellMap.get(message.shellID);
    if (!existing) {
      shellMap.set(message.shellID, message);
      continue;
    }
    shellMap.set(message.shellID, {
      ...message,
      ...existing,
      status:
        existing.status === "running" &&
        message.status &&
        message.status !== "running"
          ? message.status
          : existing.status,
      exit: existing.exit ?? message.exit,
      output: existing.output ?? message.output,
      time: { ...message.time, ...existing.time },
    });
  }

  return [
    ...messages.filter((message) => message.type !== "shell"),
    ...shellMap.values(),
  ]
    .map((message, index) => ({
      message,
      index,
      time: messageTime(message),
    }))
    .sort((left, right) => left.time - right.time || left.index - right.index)
    .map((entry) => entry.message);
}

export function loadAgentShellHistory(agentId, sessionId) {
  if (!canStore() || !agentId || !sessionId) return [];
  try {
    const raw = localStorage.getItem(storageKey(agentId, sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((message) => message?.type === "shell" && message.shellID)
      .map((message) => trimShell(message, true));
  } catch {
    return [];
  }
}

export function saveAgentShellHistory(agentId, sessionId, messages) {
  if (!canStore() || !agentId || !sessionId) return;
  try {
    const shells = messages
      .filter((message) => message?.type === "shell" && message.shellID)
      .map(trimShell)
      .slice(-MAX_ENTRIES);
    localStorage.setItem(storageKey(agentId, sessionId), JSON.stringify(shells));
  } catch {}
}

export function clearAgentShellHistory(agentId) {
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
