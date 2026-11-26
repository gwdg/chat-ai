/**
 * Writes a prompt into the chat's trailing draft message and sends it.
 *
 * The chat keeps exactly one user message at the end as its draft. That message
 * also holds attachments, which stay attached: only its text is replaced. Text
 * the user already typed is kept and the prompt is appended after it, and
 * nothing happens while a turn is still running.
 */
export function buildPromptState(localState, prompt) {
  const value = String(prompt ?? "").trim();
  const messages = localState?.messages;
  if (!value || !Array.isArray(messages) || messages.length === 0) return null;
  if (messages.some((message) => message?.loading)) return null;

  const lastIndex = messages.length - 1;
  const last = messages[lastIndex];
  if (last?.role !== "user") return null;

  const content = Array.isArray(last.content) ? last.content : [];
  const attachments = content.filter((item) => item?.type !== "text");
  const existing = content
    .filter((item) => item?.type === "text")
    .map((item) => String(item.text ?? "").trim())
    .filter(Boolean)
    .join("\n\n");

  const text = existing ? `${existing}\n\n${value}` : value;
  const next = [...messages];
  next[lastIndex] = {
    ...last,
    content: [{ type: "text", text }, ...attachments],
  };
  return { ...localState, messages: next };
}

/**
 * Sends a prompt that a UI control (a hint button, a suggestion) supplies.
 * Returns false when the chat is not ready, so the caller can stay silent.
 */
export async function sendPrompt({ localState, setLocalState, sendMessage, prompt }) {
  const next = buildPromptState(localState, prompt);
  if (!next) return false;
  setLocalState(next);
  await sendMessage({ localState: next, setLocalState });
  return true;
}
