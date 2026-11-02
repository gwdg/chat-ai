import { getDefaultChatAIModel } from "../utils/conversationUtils";
import { messagesForSummary } from "../utils/conversationSummary";
import { createBackendClient } from "./openaiClient";

export default async function generateConversationSummary({
  localState,
  userSettings = {},
}) {
  const messages = messagesForSummary(localState?.messages ?? []);
  if (!messages.length) return "";

  const model = getDefaultChatAIModel(userSettings);
  if (!model) throw new Error("No default model configured");

  const system = `You write a compact summary of a chat conversation for a sidebar tooltip.

Rules:
- Summarize in 1-2 sentences, at most 35 words.
- Focus on the user's goal and the concrete outcome or current state.
- Use the same language as the conversation.
- Do not use markdown, quotes, labels, or prefixes.
- If the conversation has no clear outcome yet, say what is being worked on.`;

  const openai = createBackendClient(30000);
  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: "system", content: system }, ...messages],
    temperature: 0.2,
    top_p: 1,
    max_tokens: 120,
    stream: false,
  });

  const summary = response?.choices?.[0]?.message?.content;
  if (typeof summary !== "string" || !summary.trim()) {
    throw new Error("The model returned an empty summary");
  }

  return summary
    .trim()
    .replace(/^["“”']+|["“”']+$/g, "")
    .replace(/\s+/g, " ");
}
