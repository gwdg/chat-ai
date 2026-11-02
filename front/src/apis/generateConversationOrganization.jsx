import { getSecretDefaultChatAIModel } from "../utils/conversationUtils";
import { createBackendClient } from "./openaiClient";

const MAX_CONVERSATIONS = 400;

function parseJson(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export default async function generateConversationOrganization({
  conversations = [],
  folders = [],
  language = "en",
}) {
  const selected = conversations.slice(0, MAX_CONVERSATIONS);
  if (!selected.length) {
    return {
      assessment: "",
      tree: [],
      titles: [],
      deletions: [],
      analyzedCount: 0,
      totalCount: conversations.length,
    };
  }

  const model =
    import.meta.env.VITE_TITLE_GENERATION_MODEL ||
    getSecretDefaultChatAIModel();
  if (!model) {
    throw new Error("No default model configured");
  }

  const knownFolderIds = new Set(folders.map((folder) => folder.id));
  const toConversationPayload = (conversation) => {
    const summary = (conversation.summary ?? "").trim();
    return {
      id: conversation.id,
      title: conversation.title || "Untitled Chat",
      ...(summary ? { summary } : {}),
    };
  };

  const topicTree = folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    color: folder.color ?? "",
    icon: folder.icon ?? "",
    conversations: selected
      .filter((conversation) => conversation.folderId === folder.id)
      .map(toConversationPayload),
  }));
  const unsortedConversations = selected
    .filter(
      (conversation) =>
        !conversation.folderId || !knownFolderIds.has(conversation.folderId),
    )
    .map(toConversationPayload);

  const system = `You reorganize a user's chat history by rewriting its topic tree.

You receive the current tree: existing topics with their conversations, plus unsorted conversations. Every conversation has an id, title, and an optional summary.

Return a complete new tree:
- The order of topics in your output is the sidebar order. You may reorder topics freely.
- Keep an existing topic by setting topic_id to its id. Rename it by providing a different name.
- For every topic, choose a color from: rose, orange, amber, emerald, teal, cyan, violet, fuchsia.
- For every topic, choose exactly one UTF-8 emoji icon from: 💬 📚 ✍️ 🎓 🩺 🔬 💼 💻 📖 🧪 💡 🚀 🌍 ✈️ 🏠 ❤️ 🏋️ 🍽️ 💰 🛒 📅 👥 🎵 📷 🎬 🎮 ⚖️ 🔧 🌱
- Merge topics by putting their conversations in one topic. Split or create topics by using topic_id "" and a new name.
- Include every existing topic you want to keep, even when it is empty, with conversation_ids: [].
- Assign every non-deleted conversation exactly once across the tree. Do not assign empty conversations to topics.
- Use the summary as the main signal for what a conversation is about. When no summary is available, use the title. Summaries may be missing, incomplete, or stale; combine them with the title when needed.
- Prefer a small number of meaningful topics over many narrow ones. A new topic should normally contain at least two conversations unless it is clearly a distinct subject.
- Propose deletions only for conversations that are clearly empty or are clear duplicates of another conversation. Use reason "empty" or "duplicate". When reason is "duplicate", set duplicate_of to the id of the conversation that should be kept; otherwise set duplicate_of to "".
- Never include a conversation in both the tree and a deletion.
- Propose a new conversation title when the current title is generic, unclear, misleading, or does not match the summary. Titles must be concise (2-6 words) in the user's UI language (${language}) and only when clearly better.
- Also write a concise plain-text assessment (2-4 sentences) of how the chats are currently organized and which changes you recommend. Use the user's UI language (${language}). Do not use markdown.
- Use only conversation and topic ids supplied by the user. Do not invent ids.

Return only JSON in exactly this shape:
{"assessment":"A short assessment of the current organization and your proposal.","tree":[{"topic_id":"existing-topic-id-or-empty","name":"Topic name","conversation_ids":["conversation-id"]}],"titles":[{"conversation_id":"conversation-id","title":"A better title"}],"deletions":[{"conversation_id":"conversation-id","reason":"empty","duplicate_of":""}]}`;

  const schema = {
    $schema: "http://json-schema.org/draft-04/schema#",
    type: "object",
    properties: {
      assessment: { type: "string" },
      tree: {
        type: "array",
        maxItems: 100,
        items: {
          type: "object",
          properties: {
            topic_id: { type: "string" },
            name: { type: "string" },
            color: {
              type: "string",
              enum: [
                "rose",
                "orange",
                "amber",
                "emerald",
                "teal",
                "cyan",
                "violet",
                "fuchsia",
              ],
            },
            icon: { type: "string" },
            conversation_ids: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["topic_id", "name", "color", "icon", "conversation_ids"],
        },
      },
      titles: {
        type: "array",
        maxItems: 50,
        items: {
          type: "object",
          properties: {
            conversation_id: { type: "string" },
            title: { type: "string" },
          },
          required: ["conversation_id", "title"],
        },
      },
      deletions: {
        type: "array",
        maxItems: 50,
        items: {
          type: "object",
          properties: {
            conversation_id: { type: "string" },
            reason: { type: "string", enum: ["empty", "duplicate"] },
            duplicate_of: { type: "string" },
          },
          required: ["conversation_id", "reason", "duplicate_of"],
        },
      },
    },
    required: ["assessment", "tree", "titles", "deletions"],
  };

  const openai = createBackendClient(60000);
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify({
          language,
          tree: {
            topics: topicTree,
            unsorted: unsortedConversations,
          },
        }),
      },
    ],
    temperature: 0.2,
    top_p: 1,
    extra_body: { guided_json: schema },
    stream: false,
  });

  const parsed = parseJson(response?.choices?.[0]?.message?.content);
  if (!parsed || !Array.isArray(parsed.tree)) {
    throw new Error("The model returned an invalid organization");
  }

  return {
    assessment:
      typeof parsed.assessment === "string" ? parsed.assessment.trim() : "",
    tree: parsed.tree,
    titles: Array.isArray(parsed.titles) ? parsed.titles : [],
    deletions: Array.isArray(parsed.deletions) ? parsed.deletions : [],
    analyzedCount: selected.length,
    totalCount: conversations.length,
    model,
  };
}
