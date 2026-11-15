const textPart = (part) => {
  if (!part || typeof part !== "object") return "";
  if (part.type === "text") return part.text ?? "";
  if (part.type === "reasoning") return part.text ?? "";
  if (part.type === "tool") {
    return `Tool: ${part.name ?? "tool"}`;
  }
  return "";
};

const messageBody = (message) => {
  if (message.type === "user") return message.text ?? "";
  if (message.type === "shell") {
    return `$ ${message.command ?? ""}\n${message.output?.output ?? ""}`;
  }
  const parts = message.content ?? message.parts ?? [];
  return parts.map(textPart).filter(Boolean).join("\n\n");
};

export function buildAgentHistoryMarkdown({
  agent,
  messages = [],
  shells = [],
  forms = [],
  exportedAt = new Date(),
  source = "server",
  cachedAt = null,
}) {
  const lines = [
    `# ${agent?.name ?? "OpenCode agent"}`,
    "",
    `- Server: ${agent?.serverUrl ?? ""}`,
    `- Session: ${agent?.sessionId ?? ""}`,
    `- Exported: ${exportedAt.toISOString()}`,
    ...(source === "cache"
      ? [
          `- Source: local cache${
            cachedAt ? ` (last synced ${new Date(cachedAt).toISOString()})` : ""
          }`,
        ]
      : []),
    "",
  ];

  for (const message of messages) {
    if (message.type === "shell") continue;
    const body = messageBody(message).trim();
    if (!body) continue;
    const role =
      message.type === "user"
        ? "User"
        : message.type === "assistant"
          ? "Assistant"
          : message.type;
    lines.push(`## ${role}`, "", body, "");
  }

  if (shells.length > 0) {
    lines.push("## Shell", "");
    for (const shell of shells) {
      lines.push(
        `### $ ${shell.command ?? ""}`,
        "",
        shell.output?.output?.trim() || "(no output)",
        "",
      );
    }
  }

  if (forms.length > 0) {
    lines.push("## Forms", "");
    for (const entry of forms) {
      lines.push(`### ${entry.form?.title ?? entry.id}`, "");
      for (const field of entry.form?.fields ?? []) {
        if (field.hidden) continue;
        const key = field.key ?? field.name;
        const value = entry.answers?.[key];
        lines.push(
          `- ${field.title || field.name || key}: ${
            value === undefined ? "(not answered)" : JSON.stringify(value)
          }`,
        );
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function buildAgentHistoryJson({
  agent,
  messages = [],
  shells = [],
  forms = [],
  exportedAt = new Date(),
  source = "server",
  cachedAt = null,
}) {
  return JSON.stringify(
    {
      agent: {
        id: agent?.id,
        name: agent?.name,
        serverUrl: agent?.serverUrl,
        sessionId: agent?.sessionId,
      },
      exportedAt: exportedAt.toISOString(),
      source,
      cachedAt: cachedAt ? new Date(cachedAt).toISOString() : null,
      messages,
      shells,
      forms,
    },
    null,
    2,
  );
}

/** The cached transcript is written into a new session's instructions, so keep it bounded. */
export const AGENT_HISTORY_RESTORE_MAX_CHARS = 100_000;

const restorePart = (part) => {
  if (!part || typeof part !== "object") return "";
  if (part.type === "text") return part.text ?? "";
  if (part.type === "tool") return `Tool: ${part.name ?? "tool"}`;
  return "";
};

const restoreMessageBody = (message) => {
  if (message.type === "user") return message.text ?? "";
  const parts = message.content ?? message.parts ?? [];
  return parts.map(restorePart).filter(Boolean).join("\n\n");
};

/**
 * Build a bounded, context-only transcript for a new session. The most recent messages win when
 * the cache exceeds the limit, because they are the ones the next prompt continues from.
 */
export function buildAgentHistoryRestoreText({
  agent,
  messages = [],
  cachedAt = null,
  maxChars = AGENT_HISTORY_RESTORE_MAX_CHARS,
}) {
  const limit = Math.max(0, Number(maxChars) || 0);
  const header = [
    "# Restored session history",
    "",
    "This transcript was restored from a local cache of an earlier OpenCode session.",
    "It is context only. Do not reply to these messages; wait for the user's next message.",
    "",
    `- Agent: ${agent?.name ?? "OpenCode agent"}`,
    `- Original session: ${agent?.sessionId ?? ""}`,
    ...(cachedAt ? [`- Cached: ${new Date(cachedAt).toISOString()}`] : []),
    "",
  ].join("\n");

  const blocks = [];
  for (const message of messages) {
    if (!message || message.type === "shell" || message.type === "idle") continue;
    const body = restoreMessageBody(message).trim();
    if (!body) continue;
    const role =
      message.type === "user"
        ? "User"
        : message.type === "assistant"
          ? "Assistant"
          : message.type;
    blocks.push(`## ${role}\n\n${body}`);
  }

  // Leave room for the omission note, which is added after we know how many blocks fit.
  const reserved = 256;
  const budget = Math.max(0, limit - header.length - reserved);
  const kept = [];
  let used = 0;
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    const cost = block.length + (kept.length ? 2 : 0);
    if (used + cost > budget) break;
    kept.unshift(block);
    used += cost;
  }

  const omitted = blocks.length - kept.length;
  const note = omitted
    ? `_${omitted} earlier message${omitted === 1 ? " was" : "s were"} omitted to stay within the restore limit._`
    : "";
  return `${header}${note ? `\n${note}\n\n` : "\n"}${
    kept.length ? `${kept.join("\n\n")}\n` : ""
  }`;
}

export function downloadAgentHistory(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
