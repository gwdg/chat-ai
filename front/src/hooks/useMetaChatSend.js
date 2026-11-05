import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { chatCompletions } from "../apis/chatCompletions";
import { extractMessageText } from "../utils/conversationSummary";
import {
  getMetaActionProposals,
  stripMetaActionMarkers,
} from "../utils/metaActions";
import {
  getPersonaMarkers,
  hasPersonaStartLink,
  stripPersonaMarkers,
} from "../utils/personaCatalog";
import { getDefaultChatAIModel } from "../utils/conversationUtils";
import {
  getFeatureGuideMarker,
  stripFeatureGuideMarkers,
} from "../config/featureGuides";
import { getUseCaseMarker, stripUseCaseMarkers } from "../config/useCases";
import {
  selectAllMemories,
  selectTimeout,
  selectUserSettings,
} from "../Redux/reducers/userSettingsReducer";
import { createMetaToolRunner, META_TOOL_DEFINITIONS } from "../utils/metaTools";

const MAX_TOOL_ROUNDS = 6;

function buildSystemPrompt() {
  return `You are the Meta chat assistant and a helpful tutor for a local chat application. You help the user understand and use Chat AI, including its features and workflows, and find and understand their past conversations and topics. You are the only assistant that can start in-app tutorials.

The app data is not embedded in this prompt. Use the provided tools to read it when needed: list_chats, list_topics, get_chat, search_messages, list_memories, get_user_settings, list_models, list_personas, list_tutorials, start_tutorial, and start_use_case. The data can change between user messages, so call the relevant tool again instead of assuming an earlier value still applies. Never invent a conversation, topic, title, id, setting, memory, model, persona, tutorial, or use case. If a tool returns nothing useful, say so plainly.

For navigation, give the user an inline Markdown link:
- Conversation: [<conversation title>](/chat/<conversation id>)
- Exact message: [<conversation title>, message](/chat/<conversation id>?message=<message id>)
- Topic: [<topic name>](/topic/<topic id>)
- Settings tab: [Open settings](/settings/<tab>), where <tab> is one of profile, chat, memories, data.

Use only ids returned by the tools. When the user asks to be taken to a chat, message, topic, or setting, give the matching link and briefly say what it opens.

You can recommend personas. Call list_personas for the catalog, then use an inline link exactly like [<short label>](/persona/<persona id>). Use only ids from the tool result and never claim a persona exists if it is not listed.

To offer an in-app tutorial, call list_tutorials for the ids. Then either call start_tutorial or give the user an inline link: [Start tutorial](/tutorial/<feature id>). For a use-case walkthrough use [Start use case](/use-case/<use case id>), or call start_use_case. The links start the walkthrough when clicked; prefer a link when the user is only asking how to use something. Do not mention tool names or markers to the user. If a tutorial cannot be started, explain that instead.

You can propose changes to the user's chats, settings, and saved memories, but only when the user explicitly asks you to change them. Never apply a change yourself and never say it is done: every change is only a proposal until the user accepts it in the interface. The current values must come from the tools, not from earlier messages. If the user asks whether a change was applied, check the current tools and answer from them; do not say you cannot check the applied state.

To propose changes, include one marker per change on its own line at the end of your answer, using exactly one of these JSON shapes:
[[RENAME_CHAT:{"id":"<conversation id>","title":"<new title>"}]]
[[MOVE_CHAT:{"id":"<conversation id>","folderId":"<existing topic id>"}]]
[[MOVE_CHAT:{"id":"<conversation id>","folderId":null,"folderName":"<new topic name>"}]]
[[PIN_CHAT:{"id":"<conversation id>","pinned":true}]]
[[PIN_TOPIC:{"id":"<topic id>","pinned":true}]]
[[SET_SETTING:{"key":"render_typst","value":true}]]
[[SET_CONVERSATION_SETTING:{"target":"all","key":"temperature","value":0.7}]]
[[SET_CONVERSATION_SETTING:{"id":"<conversation id>","key":"temperature","value":0.7}]]
[[MCP_SERVER:{"op":"add","server":"local","target":"all","url":"localhost:9000","enabled":true}]]
[[MCP_SERVER:{"op":"add","server":"remote","target":"<conversation id>","serverId":"<server id>","enabled":true,"authorization":"<optional>"}]]
[[MCP_SERVER:{"op":"update","server":"local","target":"all","url":"localhost:9000","enabled":false}]]
[[MCP_SERVER:{"op":"remove","server":"remote","target":"<conversation id>","serverId":"<server id>"}]]
[[ADD_MEMORY:{"text":"<new memory>"}]]
[[UPDATE_MEMORY:{"index":0,"text":"<updated memory>"}]]
[[DELETE_MEMORY:{"index":0}]]
[[CLEAR_MEMORIES:{}]]

Use only ids returned by the tools. Use "folderId": null for Unsorted, or provide a new folderName to create a topic. Use "pinned": true to pin a chat or topic and "pinned": false to unpin it.

Supported setting keys and values:
- memory_mode: 0 (none), 1 (recall), 2 (learn)
- suggest_user_prompts, html_load_external, set_title_once, render_typst, render_latex, conversation_summaries: true or false
- html_render_mode: "render", "code", or "off"
- html_sanitization: "strict" or "relaxed"
- document_conversion_mode: "server", "browser", or "choice"
- send_with_enter: true, false, or null
- timeout: milliseconds (5000-900000)

Supported per-chat setting keys and values:
- model: a model id from list_models
- temperature, top_p: number from 0 to 2
- reasoning_effort: number or null
- memory_mode_override: "default", 0, 1, or 2
- enable_tools, enable_web_search: true or false

Use SET_CONVERSATION_SETTING with "target":"all" only when the user explicitly asks to change all chats; otherwise use a conversation id from list_chats. The Meta chat's own settings are read-only.

MCP servers are per-chat. "local" servers are added to Local tools with a URL; "remote" servers are added to GWDG Tools with a gateway server id. The target is "all" or a conversation id; use "all" when the user does not name a chat. For a local server, provide its URL (for example localhost:9000). For a remote server, provide its server id as serverId. authorization is optional and must only contain a value the user gave you; never invent credentials.

For any other setting, do not propose a marker; use get_user_settings to find the relevant settings tab and give its deep link instead. Use list_memories before ADD_MEMORY, UPDATE_MEMORY, DELETE_MEMORY, or CLEAR_MEMORIES; indices come from that tool. Do not combine proposal markers with persona links or tutorial requests in the same answer.

Answer in the same language as the user's question. Be concise and concrete.`;
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

      const rawMessages = localState.messages
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
          hasProposals:
            message.role === "assistant" &&
            getMetaActionProposals(extractMessageText(message)).length > 0,
          decision:
            message.role === "assistant"
              ? message.meta?.actionDecision
              : undefined,
        }))
        .filter((message) => message.content.length > 0);

      const lastProposalIndex = rawMessages.reduce(
        (last, message, index) => (message.hasProposals ? index : last),
        -1,
      );
      let pendingDecision = null;
      const history = [];
      for (const [index, message] of rawMessages.entries()) {
        if (message.role === "assistant") {
          if (message.hasProposals) {
            pendingDecision = {
              decision: message.decision,
              latest: index === lastProposalIndex,
            };
          }
          history.push({ role: "assistant", content: message.content });
          continue;
        }

        let content = message.content;
        if (pendingDecision) {
          let decision = pendingDecision.decision;
          if (!decision && pendingDecision.latest) decision = "undecided";
          if (decision === "accepted") content = `I accepted the change.\n\n${content}`;
          else if (decision === "rejected") content = `I rejected the change.\n\n${content}`;
          else if (decision === "undecided") content = `I cannot decide.\n\n${content}`;
          pendingDecision = null;
        }
        history.push({ role: "user", content });
      }

      const runTool = createMetaToolRunner({
        userSettings,
        interfaceSettings,
        metaSettings: localState.settings,
        modelsData,
        memories,
      });

      const payload = {
        settings: {
          model: { id: modelId, name: modelId },
          temperature: localState.settings?.temperature ?? 0.5,
          top_p: localState.settings?.top_p ?? 0.5,
          enable_tools: false,
          tools: {},
          function_tools: META_TOOL_DEFINITIONS,
          tool_choice: "auto",
        },
        messages: [
          { role: "system", content: buildSystemPrompt() },
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
      let startedGuide = false;

      const updateAssistant = () =>
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

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const toolCalls = [];
          let roundText = "";

          for await (const chunk of chatCompletions(payload, timeoutMs, true)) {
            const delta = chunk?.choices?.[0]?.delta;
            if (typeof delta?.content === "string" && delta.content) {
              roundText += delta.content;
              accumulated += delta.content;
              updateAssistant();
            }
            for (const call of delta?.tool_calls ?? []) {
              const index = call.index ?? 0;
              const entry =
                toolCalls[index] ||
                (toolCalls[index] = {
                  id: "",
                  type: "function",
                  function: { name: "", arguments: "" },
                });
              if (call.id) entry.id = call.id;
              if (call.function?.name) entry.function.name += call.function.name;
              if (call.function?.arguments) {
                entry.function.arguments += call.function.arguments;
              }
            }
          }

          const calls = toolCalls.filter(Boolean);
          if (calls.length === 0) break;

          payload.messages.push({
            role: "assistant",
            content: roundText || null,
            tool_calls: calls.map((call, index) => {
              if (!call.id) call.id = `call_${round}_${index}`;
              return call;
            }),
          });

          for (const call of calls) {
            let result;
            try {
              const args = call.function.arguments
                ? JSON.parse(call.function.arguments)
                : {};
              result = await runTool(call.function.name, args);
              if (
                call.function.name === "start_tutorial" ||
                call.function.name === "start_use_case"
              ) {
                startedGuide = true;
              }
            } catch (toolError) {
              result = `Tool error: ${toolError.message}`;
            }
            payload.messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: typeof result === "string" ? result : JSON.stringify(result),
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
          const finalText = accumulated;
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
        const featureToStart = getFeatureGuideMarker(accumulated);
        const hasPersona =
          getPersonaMarkers(accumulated).length > 0 ||
          hasPersonaStartLink(accumulated);

        if (accumulated && !startedGuide && !hasPersona) {
          if (useCaseToStart) {
            window.dispatchEvent(
              new CustomEvent("chatai:start-use-case", {
                detail: { useCaseId: useCaseToStart },
              }),
            );
          } else if (featureToStart) {
            window.dispatchEvent(
              new CustomEvent("chatai:start-feature-guide", {
                detail: { featureId: featureToStart },
              }),
            );
          }
        }

        window.dispatchEvent(new Event("chatai:message-complete"));
      }
    },
    [timeout, userSettings, interfaceSettings, memories, modelsData, t],
  );
}
