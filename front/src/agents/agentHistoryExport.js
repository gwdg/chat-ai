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
}) {
  const lines = [
    `# ${agent?.name ?? "OpenCode agent"}`,
    "",
    `- Server: ${agent?.serverUrl ?? ""}`,
    `- Session: ${agent?.sessionId ?? ""}`,
    `- Exported: ${exportedAt.toISOString()}`,
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
      messages,
      shells,
      forms,
    },
    null,
    2,
  );
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
