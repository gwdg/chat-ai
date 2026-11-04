import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { chatCompletions } from "../apis/chatCompletions";
import { listConversationMetas, listFolders } from "../db";
import { extractMessageText } from "../utils/conversationSummary";
import {
  getPersonaMarkers,
  loadPersonaCatalog,
  stripPersonaMarkers,
} from "../utils/personaCatalog";
import { getDefaultChatAIModel } from "../utils/conversationUtils";
import {
  buildFeatureGuidePrompt,
  findFeatureGuideForText,
  getFeatureGuideMarker,
  stripFeatureGuideMarkers,
} from "../config/featureGuides";
import {
  buildUseCasePrompt,
  getUseCaseMarker,
  stripUseCaseMarkers,
} from "../config/useCases";
import {
  selectAllMemories,
  selectTimeout,
  selectUserSettings,
} from "../Redux/reducers/userSettingsReducer";

const MAX_CONVERSATIONS = 400;
const MAX_CONTEXT_CHARS = 60000;
const MAX_MEMORY_CHARS = 12000;
const MAX_PERSONA_CHARS = 16000;

function yesNo(value) {
  return value ? "yes" : "no";
}

function buildSettingsLines(userSettings = {}, interfaceSettings = {}) {
  const memoryMode =
    userSettings.memory_mode === 1
      ? "recall"
      : userSettings.memory_mode === 2
        ? "learn"
        : "off";
  const sendWithEnter =
    userSettings.send_with_enter === null ||
    userSettings.send_with_enter === undefined
      ? "device default"
      : userSettings.send_with_enter
        ? "Enter"
        : "Shift+Enter";
  const documentConversion =
    userSettings.document_conversion_mode === "browser"
      ? "browser only (local)"
      : userSettings.document_conversion_mode === "server"
        ? "server only"
        : "by choice";
  const model = userSettings.model;
  const modelName =
    typeof model === "string"
      ? model
      : model?.name || model?.id || "not set";

  return [
    `- Default model: ${modelName}`,
    `- Memory mode: ${memoryMode}`,
    `- Saved memories: ${userSettings.memories?.length ?? 0} (stored in this browser)`,
    `- Request timeout: ${Math.round((userSettings.timeout ?? 300000) / 1000)} seconds`,
    `- Suggest follow-up prompts: ${yesNo(userSettings.suggest_user_prompts)}`,
    `- Set title only on first prompt: ${yesNo(userSettings.set_title_once)}`,
    `- Conversation summaries: ${yesNo(userSettings.conversation_summaries)}`,
    `- Send message with: ${sendWithEnter}`,
    `- HTML rendering: ${userSettings.html_render_mode ?? "off"}`,
    `- Load external references: ${yesNo(userSettings.html_load_external)}`,
    `- HTML sanitization: ${userSettings.html_sanitization ?? "strict"}`,
    `- Render Typst: ${yesNo(userSettings.render_typst)}`,
    `- Render LaTeX: ${yesNo(userSettings.render_latex)}`,
    `- Document conversion: ${documentConversion}`,
    `- Dark mode: ${yesNo(interfaceSettings.dark_mode)}`,
    `- Show usage in sidebar: ${yesNo(interfaceSettings.show_usage_in_sidebar)}`,
    `- Chat sorting: ${interfaceSettings.conversation_sort ?? "created_desc"}`,
    `- Chat grouping: ${interfaceSettings.conversation_grouping ?? "topic"}`,
    `- Web search disclaimer accepted: ${yesNo(interfaceSettings.agree_web_search)}`,
    `- Show welcome tour: ${yesNo(interfaceSettings.show_tour)}`,
    `- Confirmation warnings: clear history ${yesNo(interfaceSettings.warn_clear_history)}, share settings ${yesNo(interfaceSettings.warn_share_settings)}, regenerate ${yesNo(interfaceSettings.warn_regenerate)}, fork ${yesNo(interfaceSettings.warn_fork)}`,
    `- Completed tutorials: ${interfaceSettings.completed_tutorials?.length ?? 0}`,
    `- Completed use cases: ${interfaceSettings.completed_use_cases?.length ?? 0}`,
    `- Suppressed tutorials: ${interfaceSettings.suppressed_tutorials?.length ?? 0}`,
  ];
}

function buildSystemPrompt(
  conversations,
  topics,
  persons,
  memories,
  userSettings,
  interfaceSettings,
) {
  const topicById = new Map(
    topics.map((topic) => [topic.id, topic.name]),
  );
  const topicLines = topics
    .map((topic) => `- id: ${topic.id}\n  name: ${topic.name}`)
    .join("\n") || "(no topics available)";
  let used = topicLines.length;
  const lines = [];

  const personaLines = [];
  let personaUsed = 0;
  for (const persona of persons) {
    const description = persona.description || "(no description)";
    const line = `- id: ${persona.id}\n  title: ${persona.title}\n  category: ${persona.category || "uncategorized"}\n  description: ${description}`;
    if (personaUsed + line.length > MAX_PERSONA_CHARS) break;
    personaLines.push(line);
    personaUsed += line.length;
  }

  const memoryLines = [];
  let memoryUsed = 0;
  for (const memory of memories) {
    const text = String(memory || "").trim();
    if (!text) continue;
    if (memoryUsed + text.length > MAX_MEMORY_CHARS) break;
    memoryLines.push(`- ${text}`);
    memoryUsed += text.length;
  }

  for (const conversation of conversations.slice(0, MAX_CONVERSATIONS)) {
    const summary = conversation.summary || "(no summary available)";
    const modified = conversation.lastModified
      ? new Date(conversation.lastModified).toISOString()
      : "unknown";
    const topicName = conversation.folderId
      ? topicById.get(conversation.folderId) || "Unsorted"
      : "Unsorted";
    const topicId = conversation.folderId
      ? ` (id: ${conversation.folderId})`
      : "";
    const line = `- id: ${conversation.id}\n  title: ${conversation.title}\n  topic: ${topicName}${topicId}\n  summary: ${summary}\n  last modified: ${modified}`;
    if (used + line.length > MAX_CONTEXT_CHARS) break;
    lines.push(line);
    used += line.length;
  }

  return `You are the Meta chat assistant and a helpful tutor for a local chat application. You help the user understand and use Chat AI, including its features and workflows, and find and understand their past conversations and topics. You are the only assistant that can start in-app tutorials.

When explaining a feature, be concrete about where it is and what happens step by step. Do not invent features, buttons, or behaviour that are not described to you. If you do not know how something works, say so and suggest contacting support or consulting the documentation instead.

You receive metadata for the user's conversations and topics (categories). Each conversation has an id, title, topic, summary, and last-modified time. For questions about the user's conversations and topics, this metadata and any saved memories are your only sources. Summaries may be missing or stale. Never invent a conversation, topic, title, id, summary, or memory.

Use the topic tree to answer questions about which topic or category contains something. When naming a topic, use its exact name.

The global user preferences and interface settings are listed in <user_settings>. Use only those values when answering questions about the user's settings. Do not invent settings that are not listed.

For questions about whether settings are safe, explain the actual values and their implications:
- "Load external references: no" and "HTML sanitization: strict" reduce third-party requests and are the safer choices.
- "Document conversion: browser only" keeps PDF/DOCX conversion in the browser; "server only" or "by choice" may send files to the server.
- Saved memories are stored in this browser.
- Web Search, tools, Arcana, MCP servers, and external models are conversation-specific and can send data outside the local browser; they are not part of these global settings.

When you refer to a conversation, always link to it using exactly this Markdown form:
[<conversation title>](/chat/<conversation id>)
Use only ids from the list below. Do not link to any other URL or invent an id. If nothing matches the user's question, say so plainly.

Answer in the same language as the user's question. Be concise and concrete.

You may also receive the user's saved memories. Use them when relevant, but they may be stale. Never invent memories.

You can also recommend personas from the persona catalog below. A persona is a ready-made chat setup with its own title and description. Recommend a persona only when its title or description clearly matches what the user asks for. Never invent a persona or claim that one exists if it is not listed. When you recommend a persona, name it and briefly explain why it fits.

To let the user start a chat with a recommended persona, end your answer with exactly [[PERSONA:<persona id>]] on its own line, using only an id from the persona list. You may recommend more than one persona; put each marker on its own line. Do not mention these markers to the user. Do not combine a [[PERSONA:...]] marker with a [[GUIDE:...]] or [[USE_CASE:...]] marker in the same answer.

<personas>
${personaLines.join("\n") || "(no personas available)"}
</personas>

<features>
${buildFeatureGuidePrompt()}
</features>

You have a skill to start in-app tutorials and use-case walkthroughs. Use it only in this Meta chat.

When the user asks how to use a listed feature, give concise, concrete steps. End your answer with exactly [[GUIDE:<feature id>]] on its own line, using only an id from the features list above.

When the user asks to start, show, or walk through a use case, give a short introduction and end your answer with exactly [[USE_CASE:<use case id>]] on its own line, using only an id from the use case list below. Use either [[GUIDE:...]] or [[USE_CASE:...]], never both. Do not mention the markers to the user.

If the user asks what you can teach, start, or which features and use cases you know, summarise both lists above.

<use_cases>
${buildUseCasePrompt()}
</use_cases>

When the user describes a goal rather than naming a feature, suggest a concrete workflow from the use cases above and end with [[USE_CASE:<use case id>]].

<user_settings>
${buildSettingsLines(userSettings, interfaceSettings).join("\n")}
</user_settings>

<topics>
${topicLines}
</topics>

<conversations>
${lines.join("\n") || "(no conversations available)"}
</conversations>${
    memoryLines.length
      ? `

<memories>
${memoryLines.join("\n")}
</memories>`
      : ""
  }`;
}

async function loadMetaContext() {
  const [rows, folders, persons] = await Promise.all([
    listConversationMetas(),
    listFolders(),
    loadPersonaCatalog().catch(() => []),
  ]);

  const conversations = (rows || [])
    .filter(
      (row) =>
        row?.id &&
        row?.hasFirstPrompt !== false &&
        !row.isMetaChat &&
        row.id !== "meta-chat",
    )
    .sort(
      (a, b) =>
        (b.lastModified ?? b.createdAt ?? 0) -
        (a.lastModified ?? a.createdAt ?? 0),
    )
    .slice(0, MAX_CONVERSATIONS)
    .map((row) => ({
      id: row.id,
      title: (row.title || "").trim() || "Untitled Chat",
      summary: (row.summary || "").trim(),
      folderId: row.folderId ?? null,
      lastModified: row.lastModified ?? row.createdAt ?? 0,
    }));

  const topics = (folders || []).map((folder) => ({
    id: folder.id,
    name: (folder.name || "").trim() || "Untitled topic",
  }));

  return { conversations, topics, persons };
}

export function useMetaChatSend() {
  const timeout = useSelector(selectTimeout);
  const userSettings = useSelector(selectUserSettings);
  const interfaceSettings = useSelector((state) => state.interface_settings);
  const memories = useSelector(selectAllMemories);
  const { t } = useTranslation();

  return useCallback(
    async ({ localState, setLocalState }) => {
      if (!setLocalState) return;

      const modelId =
        (typeof localState.settings?.model === "string"
          ? localState.settings.model
          : localState.settings?.model?.id) ||
        getDefaultChatAIModel(userSettings);
      if (!modelId) {
        setLocalState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: [{ type: "text", text: "" }],
              loading: false,
              meta: { error: t("meta_chat.no_model") },
            },
            { role: "user", content: [{ type: "text", text: "" }] },
          ],
        }));
        return;
      }

      let conversations = [];
      let topics = [];
      let persons = [];
      try {
        ({ conversations, topics, persons } = await loadMetaContext());
      } catch (error) {
        console.error("Failed to load conversation summaries", error);
      }

      const history = localState.messages
        .filter(
          (message) =>
            message.role === "user" || message.role === "assistant",
        )
        .map((message) => ({
          role: message.role,
          content: stripPersonaMarkers(
            stripUseCaseMarkers(
              stripFeatureGuideMarkers(extractMessageText(message)),
            ),
          ).trim(),
        }))
        .filter((message) => message.content.length > 0);

      const lastUserMessage = [...history]
        .reverse()
        .find((message) => message.role === "user")?.content;
      const suggestedFeature = findFeatureGuideForText(lastUserMessage);
      const wantsTutorial =
        /\b(show me|walk me through|start (?:a )?tutorial|demonstrate|guide me|zeig(?:e|en)?(?: Sie)?(?: es)? mir(?: bitte)?|führ(?:e|en)?(?: Sie)? mich(?: bitte)? durch|start(?:e|en)?(?: Sie)?(?: bitte)? (?:ein |eine )?(?:tutorial|anleitung)|demonstrier(?:e|en)?(?: Sie)?|leit(?:e|en)?(?: Sie)? mich(?: bitte)? an)\b/i.test(
          lastUserMessage || "",
        );

      const payload = {
        settings: {
          model: { id: modelId, name: modelId },
          temperature: localState.settings?.temperature ?? 0.5,
          top_p: localState.settings?.top_p ?? 0.5,
          enable_tools: false,
          tools: {},
        },
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(
              conversations,
              topics,
              persons,
              (memories || []).map((memory) => memory?.text || ""),
              userSettings,
              interfaceSettings,
            ),
          },
          ...history,
        ],
      };

      const conversationId = localState.id;
      const timeoutMs =
        timeout >= 5000 && timeout <= 900000 ? timeout : 300000;

      setLocalState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            role: "assistant",
            content: [{ type: "text", text: "" }],
            loading: true,
          },
          { role: "user", content: [{ type: "text", text: "" }] },
        ],
      }));

      let accumulated = "";
      let errorMeta = null;

      try {
        for await (const chunk of chatCompletions(payload, timeoutMs, true)) {
          const piece = chunk?.choices?.[0]?.delta?.content;
          if (typeof piece === "string" && piece) {
            accumulated += piece;
            setLocalState((prev) => {
              if (prev.id !== conversationId) return prev;
              const messages = [...prev.messages];
              const index = messages.length - 2;
              if (messages[index]?.role !== "assistant") return prev;
              messages[index] = {
                ...messages[index],
                content: [{ type: "text", text: accumulated }],
              };
              return { ...prev, messages };
            });
          }
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("Meta chat failed", error);
          errorMeta = { error: error?.message || t("meta_chat.error") };
        }
      } finally {
        setLocalState((prev) => {
          if (prev.id !== conversationId) return prev;
          const messages = [...prev.messages];
          const index = messages.length - 2;
          if (messages[index]?.role !== "assistant") return prev;
          if (!messages[index].loading) return prev;
          const personaMarkers = getPersonaMarkers(accumulated);
          const finalText =
            accumulated &&
            suggestedFeature &&
            personaMarkers.length === 0 &&
            !getFeatureGuideMarker(accumulated) &&
            !getUseCaseMarker(accumulated)
              ? `${accumulated}\n\n[[GUIDE:${suggestedFeature}]]`
              : accumulated;
          messages[index] = {
            ...messages[index],
            content: finalText
              ? [{ type: "text", text: finalText }]
              : messages[index].content,
            loading: false,
            ...(errorMeta ? { meta: errorMeta } : {}),
          };
          return { ...prev, messages };
        });

        const useCaseToStart = getUseCaseMarker(accumulated);
        const featureToStart =
          getFeatureGuideMarker(accumulated) ||
          (!useCaseToStart ? suggestedFeature : null);

        if (
          accumulated &&
          wantsTutorial &&
          getPersonaMarkers(accumulated).length === 0 &&
          useCaseToStart
        ) {
          window.dispatchEvent(
            new CustomEvent("chatai:start-use-case", {
              detail: { useCaseId: useCaseToStart },
            }),
          );
        } else if (
          accumulated &&
          wantsTutorial &&
          getPersonaMarkers(accumulated).length === 0 &&
          featureToStart
        ) {
          window.dispatchEvent(
            new CustomEvent("chatai:start-feature-guide", {
              detail: { featureId: featureToStart },
            }),
          );
        }

        window.dispatchEvent(new Event("chatai:message-complete"));
      }
    },
    [timeout, userSettings, interfaceSettings, memories, t],
  );
}
