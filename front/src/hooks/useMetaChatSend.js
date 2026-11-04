import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { chatCompletions } from "../apis/chatCompletions";
import {
  getRecentMessageExcerpts,
  listConversationMetas,
  listFolders,
  searchMessages,
} from "../db";
import { extractMessageText } from "../utils/conversationSummary";
import { stripMetaActionMarkers } from "../utils/metaActions";
import {
  getPersonaMarkers,
  hasPersonaStartLink,
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
const MAX_SEARCH_CHARS = 16000;

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
    `- Modules: tools ${import.meta.env.VITE_MODULE_TOOLS === "true" ? "enabled" : "disabled"}, feedback ${import.meta.env.VITE_MODULE_FEEDBACK === "true" ? "enabled" : "disabled"}, choices ${import.meta.env.VITE_MODULE_CHOICES === "true" ? "enabled" : "disabled"}, speech ${import.meta.env.VITE_MODULE_SPEECH === "true" ? "enabled" : "disabled"}`,
    `- Dark mode: ${yesNo(interfaceSettings.dark_mode)}`,
    `- Show usage in sidebar: ${yesNo(interfaceSettings.show_usage_in_sidebar)}`,
    `- Chat sorting: ${interfaceSettings.conversation_sort ?? "created_desc"}`,
    `- Chat grouping: ${interfaceSettings.conversation_grouping ?? "topic"}`,
    `- Web search disclaimer accepted: ${yesNo(interfaceSettings.agree_web_search)}`,
    `- Show welcome tour: ${yesNo(interfaceSettings.show_tour)}`,
    `- Confirmation warnings: clear history ${yesNo(interfaceSettings.warn_clear_history)}, close chat ${yesNo(interfaceSettings.warn_close_chat)}, share settings ${yesNo(interfaceSettings.warn_share_settings)}, regenerate ${yesNo(interfaceSettings.warn_regenerate)}, fork ${yesNo(interfaceSettings.warn_fork)}`,
    `- Completed tutorials: ${interfaceSettings.completed_tutorials?.length ?? 0}`,
    `- Completed use cases: ${interfaceSettings.completed_use_cases?.length ?? 0}`,
    `- Suppressed tutorials: ${interfaceSettings.suppressed_tutorials?.length ?? 0}`,
  ];
}

function buildConversationSettingsSummary(settings = {}) {
  const model =
    typeof settings.model === "string"
      ? settings.model
      : settings.model?.name || settings.model?.id || "not set";
  const tools = settings.tools || {};
  const enabledTools = Object.entries(tools)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
  const memoryOverride =
    settings.memory_mode_override === "default" ||
    settings.memory_mode_override === undefined
      ? "default"
      : ["off", "recall", "learn"][Number(settings.memory_mode_override)] ||
        String(settings.memory_mode_override);
  const reasoning =
    settings.reasoning_effort === null ||
    settings.reasoning_effort === undefined
      ? "default"
      : settings.reasoning_effort;
  const arcanaId = settings.arcana?.id || "";
  const hasMcp =
    (typeof settings.mcp_servers === "string" &&
      settings.mcp_servers.trim().length > 0) ||
    (Array.isArray(settings.mcp_servers) && settings.mcp_servers.length > 0);

  return [
    `model ${model}`,
    `temperature ${settings.temperature ?? "default"}`,
    `top_p ${settings.top_p ?? "default"}`,
    `reasoning effort ${reasoning}`,
    `memory mode override ${memoryOverride}`,
    `tools ${settings.enable_tools ? "enabled" : "disabled"}${
      settings.enable_tools && enabledTools.length
        ? ` (${enabledTools.join(", ")})`
        : ""
    }`,
    `arcana ${arcanaId || "none"}`,
    `MCP ${hasMcp ? "configured" : "none"}`,
  ].join("; ");
}

function buildSystemPrompt(
  conversations,
  topics,
  persons,
  messageMatches,
  memories,
  userSettings,
  interfaceSettings,
  metaChatSettings,
  availableModels,
) {
  const topicById = new Map(
    topics.map((topic) => [topic.id, topic.name]),
  );
  const topicLines =
    topics
      .map(
        (topic) =>
          `- id: ${topic.id}\n  name: ${topic.name}\n  pinned: ${topic.pinned ? "yes" : "no"}`,
      )
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

  const modelLines =
    availableModels
      .map((model) => `- id: ${model.id}\n  name: ${model.name || model.id}`)
      .join("\n") || "(no models available)";

  const searchLines = [];
  let searchUsed = 0;
  for (const match of messageMatches) {
    const date = match.createdAt
      ? new Date(match.createdAt).toISOString()
      : "unknown";
    const line = `- conversation id: ${match.conversationId}\n  conversation title: ${match.conversationTitle}\n  topic: ${match.topicName || "Unsorted"}\n  message id: ${match.messageId}\n  role: ${match.role}\n  date: ${date}\n  excerpt: ${match.snippet}`;
    if (searchUsed + line.length > MAX_SEARCH_CHARS) break;
    searchLines.push(line);
    searchUsed += line.length;
  }

  const memoryLines = [];
  let memoryUsed = 0;
  for (const [index, memory] of memories.entries()) {
    const text = String(memory || "").trim();
    if (!text) continue;
    if (memoryUsed + text.length > MAX_MEMORY_CHARS) break;
    memoryLines.push(`- index: ${index}\n  text: ${text}`);
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
    const line = `- id: ${conversation.id}\n  title: ${conversation.title}\n  topic: ${topicName}${topicId}\n  pinned: ${conversation.pinned ? "yes" : "no"}\n  summary: ${summary}\n  per-chat settings: ${conversation.settingsSummary}\n  last modified: ${modified}`;
    if (used + line.length > MAX_CONTEXT_CHARS) break;
    lines.push(line);
    used += line.length;
  }

  return `You are the Meta chat assistant and a helpful tutor for a local chat application. You help the user understand and use Chat AI, including its features and workflows, and find and understand their past conversations and topics. You are the only assistant that can start in-app tutorials.

When explaining a feature, be concrete about where it is and what happens step by step. Do not invent features, buttons, or behaviour that are not described to you. If you do not know how something works, say so and suggest contacting support or consulting the documentation instead.

You receive metadata for the user's conversations and topics (categories). Each conversation has an id, title, topic, pinned state, summary, per-chat settings, and last-modified time. Each topic has an id, name, and pinned state. Pinned chats and topics appear in a separate area at the top of the sidebar, regardless of the selected grouping. The per-chat settings are local to that conversation and may differ from the global preferences in <user_settings>; use them for questions about models, temperature, top_p, reasoning effort, memory-mode overrides, tools, Arcana, and MCP. For questions about the user's conversations and topics, this metadata and any saved memories are your only sources. Summaries may be missing or stale. Never invent a conversation, topic, title, id, summary, setting, or memory.

Use the topic tree to answer questions about which topic or category contains something. When naming a topic, use its exact name.

The global user preferences and interface settings are listed in <user_settings>. Use only those values when answering questions about the user's settings. Do not invent settings that are not listed.

For questions about whether settings are safe, explain the actual values and their implications:
- "Load external references: no" and "HTML sanitization: strict" reduce third-party requests and are the safer choices.
- "Document conversion: browser only" keeps PDF/DOCX conversion in the browser; "server only" or "by choice" may send files to the server.
- Saved memories are stored in this browser.
- Web Search, tools, Arcana, MCP servers, and external models are conversation-specific and can send data outside the local browser; they are not part of these global settings.

You can help the user navigate the app with these deep links:
- Conversation: [<conversation title>](/chat/<conversation id>)
- Exact message: [<conversation title>, message](/chat/<conversation id>?message=<message id>)
- Topic: [<topic name>](/topic/<topic id>)
- Settings tab: [Open settings](/settings/<tab>), where <tab> is one of profile, chat, memories, data.

Use only ids from the lists below. When the user asks to be taken to a chat, message, topic, or setting, give the matching link and briefly say what it opens. Never invent an id. If nothing matches the user's question, say so plainly.

Answer in the same language as the user's question. Be concise and concrete.

You may also receive the user's saved memories. Use them when relevant, but they may be stale. Never invent memories.

You can also recommend personas from the persona catalog below. A persona is a ready-made chat setup with its own title and description. Recommend a persona only when its title or description clearly matches what the user asks for. Never invent a persona or claim that one exists if it is not listed. When you recommend a persona, name it and briefly explain why it fits.

To let the user start a chat with a recommended persona, include an inline Markdown link using exactly this URL form: [<short label>](/persona/<persona id>). For example: [Start chat with <persona title>](/persona/<persona id>). Use only ids from the persona list and keep the link inline in your sentence or at the end of your answer. You may recommend more than one persona; give each one its own link. Do not use [[PERSONA:...]] markers, and do not combine a persona link with a [[GUIDE:...]] or [[USE_CASE:...]] marker in the same answer.

<personas>
${personaLines.join("\n") || "(no personas available)"}
</personas>

<message_search_results>
${searchLines.join("\n") || "(no message matches for the current question)"}
</message_search_results>

The message search results above are exact excerpts selected from the user's stored messages. Use them when the user asks where something was said, decided, or agreed. Cite each point with the exact message link, for example [<conversation title>, message](/chat/<conversation id>?message=<message id>). Never invent a message, id, or quote. If the excerpts are insufficient, say so.

When the user asks to compare conversations or extract decisions and action items, base the answer only on the summaries and message excerpts provided, attribute each point to its conversation or message, and clearly mark uncertain or inferred items.

The module flags in <user_settings> show which optional UI areas this deployment provides. If the user asks for a feature that is disabled, explain that this deployment disables that module. Conversation-specific tools may also be unavailable for the selected model or switched off in the conversation; do not claim a hidden feature exists.

You can propose changes to the user's chats, settings, and saved memories, but only when the user explicitly asks you to change them. Never apply a change yourself and never say it is done: every change is only a proposal until the user accepts it in the interface.

To propose changes, include one marker per change on its own line at the end of your answer, using exactly one of these JSON shapes:
[[RENAME_CHAT:{"id":"<conversation id>","title":"<new title>"}]]
[[MOVE_CHAT:{"id":"<conversation id>","folderId":"<existing topic id>"}]]
[[MOVE_CHAT:{"id":"<conversation id>","folderId":null,"folderName":"<new topic name>"}]]
[[PIN_CHAT:{"id":"<conversation id>","pinned":true}]]
[[PIN_TOPIC:{"id":"<topic id>","pinned":true}]]
[[SET_SETTING:{"key":"render_typst","value":true}]]
[[SET_CONVERSATION_SETTING:{"target":"all","key":"temperature","value":0.7}]]
[[SET_CONVERSATION_SETTING:{"id":"<conversation id>","key":"temperature","value":0.7}]]
[[ADD_MEMORY:{"text":"<new memory>"}]]
[[UPDATE_MEMORY:{"index":0,"text":"<updated memory>"}]]
[[DELETE_MEMORY:{"index":0}]]
[[CLEAR_MEMORIES:{}]]

Use only conversation ids from <conversations>, topic ids from <topics>, and memory indices from <memories>. Use "folderId": null for Unsorted, or provide a new folderName to create a topic. Use "pinned": true to pin a chat or topic and "pinned": false to unpin it.

Supported setting keys and values:
- memory_mode: 0 (none), 1 (recall), 2 (learn)
- suggest_user_prompts, html_load_external, set_title_once, render_typst, render_latex, conversation_summaries: true or false
- html_render_mode: "render", "code", or "off"
- html_sanitization: "strict" or "relaxed"
- document_conversion_mode: "server", "browser", or "choice"
- send_with_enter: true, false, or null
- timeout: milliseconds (5000-900000)

Supported per-chat setting keys and values:
- model: a model id from <available_models>
- temperature, top_p: number from 0 to 2
- reasoning_effort: number or null
- memory_mode_override: "default", 0, 1, or 2
- enable_tools, enable_web_search: true or false

Use SET_CONVERSATION_SETTING with "target":"all" only when the user explicitly asks to change all chats; otherwise use a conversation id from <conversations>. These markers change per-chat settings, not global preferences. The Meta chat's own settings are read-only and must not be changed with these markers.

For any other setting, do not propose a marker; give the relevant settings deep link instead. For memories, use ADD_MEMORY for a new memory, UPDATE_MEMORY or DELETE_MEMORY with the index from <memories>, and CLEAR_MEMORIES to delete all memories. You may include multiple markers, including chat, setting, and memory changes together. Do not use these markers for advice or tutorials, and do not combine them with persona markers.

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

<meta_chat_settings>
${buildConversationSettingsSummary(metaChatSettings)}
</meta_chat_settings>

<available_models>
${modelLines}
</available_models>

The Meta chat's own settings are in <meta_chat_settings>. They are read-only here; use them when the user asks what settings the Meta chat uses, and do not confuse them with global preferences or other chats.

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

async function loadMetaContext(query = "") {
  const wantsSurvey =
    /\b(decisions?|action items?|next steps?|todos?|compare|comparison|agreed|beschlossen|entscheid|aufgaben|nächste schritte|vereinbart|vergleich)\b/i.test(
      query || "",
    );

  const [rows, folders, persons, matches, recent] = await Promise.all([
    listConversationMetas(),
    listFolders(),
    loadPersonaCatalog().catch(() => []),
    searchMessages(query).catch(() => []),
    wantsSurvey
      ? getRecentMessageExcerpts().catch(() => [])
      : Promise.resolve([]),
  ]);

  const conversations = (rows || [])
    .filter(
      (row) =>
        row?.id &&
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
      pinned: row.pinned === true,
      lastModified: row.lastModified ?? row.createdAt ?? 0,
      settingsSummary: buildConversationSettingsSummary(row.settings),
    }));

  const topics = (folders || []).map((folder) => ({
    id: folder.id,
    name: (folder.name || "").trim() || "Untitled topic",
    pinned: folder.pinned === true,
  }));

  const topicNames = new Map(topics.map((topic) => [topic.id, topic.name]));
  const seenMessages = new Set();
  const messageMatches = [...(matches || []), ...(recent || [])]
    .filter((match) => {
      if (!match?.messageId || seenMessages.has(match.messageId)) return false;
      seenMessages.add(match.messageId);
      return true;
    })
    .slice(0, 20)
    .map((match) => ({
      ...match,
      topicName: match.folderId
        ? topicNames.get(match.folderId) || "Unsorted"
        : "Unsorted",
    }));

  return { conversations, topics, persons, messageMatches };
}

export function useMetaChatSend(modelsData = []) {
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

      const history = localState.messages
        .filter(
          (message) =>
            message.role === "user" || message.role === "assistant",
        )
        .map((message) => ({
          role: message.role,
          content: stripMetaActionMarkers(
            stripPersonaMarkers(
              stripUseCaseMarkers(
                stripFeatureGuideMarkers(extractMessageText(message)),
              ),
            ),
          ).trim(),
        }))
        .filter((message) => message.content.length > 0);

      const lastUserMessage = [...history]
        .reverse()
        .find((message) => message.role === "user")?.content;

      let conversations = [];
      let topics = [];
      let persons = [];
      let messageMatches = [];
      try {
        ({ conversations, topics, persons, messageMatches } =
          await loadMetaContext(lastUserMessage));
      } catch (error) {
        console.error("Failed to load conversation context", error);
      }

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
              messageMatches,
              (memories || []).map((memory) => memory?.text || ""),
              userSettings,
              interfaceSettings,
              localState.settings,
              modelsData,
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
          const hasPersona =
            getPersonaMarkers(accumulated).length > 0 ||
            hasPersonaStartLink(accumulated);
          const finalText =
            accumulated &&
            suggestedFeature &&
            !hasPersona &&
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
        const hasPersona =
          getPersonaMarkers(accumulated).length > 0 ||
          hasPersonaStartLink(accumulated);

        if (accumulated && wantsTutorial && !hasPersona && useCaseToStart) {
          window.dispatchEvent(
            new CustomEvent("chatai:start-use-case", {
              detail: { useCaseId: useCaseToStart },
            }),
          );
        } else if (
          accumulated &&
          wantsTutorial &&
          !hasPersona &&
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
    [timeout, userSettings, interfaceSettings, memories, modelsData, t],
  );
}
