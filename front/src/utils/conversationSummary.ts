const MAX_SUMMARY_CHARS = 24000;
const MAX_MESSAGE_CHARS = 4000;

export function extractMessageText(message: any): string {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item: any) => item?.type === "text")
    .map((item: any) => item?.text ?? "")
    .join("\n");
}

export function conversationSummarySignature(messages: any[] = []): string {
  const text = messages
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .map((message) => `${message.role}:${extractMessageText(message)}`)
    .join("\u0001");

  if (!text.trim()) return "";

  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function messagesForSummary(messages: any[] = []) {
  const eligible = messages
    .filter((message) => message?.role === "user" || message?.role === "assistant")
    .map((message) => {
      const text = extractMessageText(message).trim();
      if (!text) return null;
      return {
        role: message.role,
        content:
          text.length > MAX_MESSAGE_CHARS
            ? text.slice(text.length - MAX_MESSAGE_CHARS)
            : text,
      };
    })
    .filter(Boolean) as Array<{ role: string; content: string }>;

  const selected: Array<{ role: string; content: string }> = [];
  let used = 0;

  for (let index = eligible.length - 1; index >= 0; index -= 1) {
    const message = eligible[index];
    if (selected.length && used + message.content.length > MAX_SUMMARY_CHARS) {
      break;
    }
    selected.unshift(message);
    used += message.content.length;
  }

  return selected;
}
