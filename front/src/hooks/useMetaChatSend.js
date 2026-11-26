import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { chatCompletions } from "../apis/chatCompletions";
import { modelSupportsTools } from "../apis/agentEndpoints";
import { useToast } from "./useToast";
import generateMemory from "../apis/generateMemory";
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
  addMemory,
  editMemory,
  selectAllMemories,
  selectDefaultMemoryGroup,
  selectMemoryGroups,
  selectMemoryMode,
  selectTimeout,
  selectUserSettings,
} from "../Redux/reducers/userSettingsReducer";
import { createMetaToolRunner, getMetaToolDefinitions } from "../utils/metaTools";
import { isFeatureEnabled } from "../config/deployment";
import { saveFileReady } from "../db";

const MAX_TOOL_ROUNDS = 6;
export const META_LAST_CHECK_KEY = "chatai.meta.last-check";
export const META_LAST_CHECK_RESULT_KEY = "chatai.meta.last-check-result";

function buildSystemPrompt() {
  const prompt = `You are the Meta chat assistant and a helpful tutor for a local chat application. You help the user understand and use Chat AI, including its features and workflows, and find and understand their past conversations and topics. You are the only assistant that can start in-app tutorials.

The app data is not embedded in this prompt. Use the provided tools to read it when needed: list_chats, list_topics, get_chat, search_messages, list_memories, get_user_settings, list_e2ee_keys, list_models, list_personas, list_tutorials, start_tutorial, and start_use_case. For OpenCode agents use list_agents, list_agent_sessions, get_agent_history, and the agent file tools. The data can change between user messages, so call the relevant tool again instead of assuming an earlier value still applies. Never invent a conversation, topic, title, id, setting, memory, model, persona, tutorial, or use case. If a tool returns nothing useful, say so plainly. Memories can be grouped: list_memories returns the available memory groups, each memory's group, and the default memory group. Use it when the user asks about memory groups instead of saying memories are not grouped.

For navigation, give the user an inline Markdown link:
- Conversation: [<conversation title>](/chat/<conversation id>)
- Exact message: [<conversation title>, message](/chat/<conversation id>?message=<message id>)
- Topic: [<topic name>](/topic/<topic id>)
- Settings tab: [Open settings](/settings/<tab>), where <tab> is one of profile, chat, memories, encryption, data.
- Agent message: [Agent name, role](/agent/<agent id>?message=<message id>)
- Agent file: [file path](/agent/<agent id>?file=<URL-encoded path>)

Use only ids returned by the tools. When the user asks to be taken to a chat, message, topic, or setting, give the matching link and briefly say what it opens.

You can recommend personas. Call list_personas for the catalog, then use an inline link exactly like [<short label>](/persona/<persona id>). Use only ids from the tool result and never claim a persona exists if it is not listed.

To offer an in-app tutorial, call list_tutorials for the ids. Then either call start_tutorial or give the user an inline link: [Start tutorial](/tutorial/<feature id>). For a use-case walkthrough use [Start use case](/use-case/<use case id>), or call start_use_case. The links start the walkthrough when clicked; prefer a link when the user is only asking how to use something. Do not mention tool names or markers to the user. If a tutorial cannot be started, explain that instead.

You can propose changes to the user's chats, settings, and saved memories, but only when the user explicitly asks you to change them. Never apply a change yourself and never say it is done: every change is only a proposal until the user accepts it in the interface. The current values must come from the tools, not from earlier messages. If the user asks whether a change was applied, check the current tools and answer from them; do not say you cannot check the applied state.

To propose changes, include one marker per change on its own line at the end of your answer, using exactly one of these JSON shapes:
[[CREATE_CHAT:{"title":"<title>","folderName":"<optional topic>","settings":{"model":"<model id>","temperature":0.7,"tools":{"web_search":true},"mcp_local_server_ids":["<server id>"]},"messages":[{"role":"system","content":"<system prompt>"},{"role":"user","content":"<first question>"},{"role":"assistant","content":"<optional prior answer>"}]}]]
[[RENAME_CHAT:{"id":"<conversation id>","title":"<new title>"}]]
[[MOVE_CHAT:{"id":"<conversation id>","folderId":"<existing topic id>"}]]
[[MOVE_CHAT:{"id":"<conversation id>","folderId":null,"folderName":"<new topic name>"}]]
[[PIN_CHAT:{"id":"<conversation id>","pinned":true}]]
[[PIN_TOPIC:{"id":"<topic id>","pinned":true}]]
[[PIN_WORKSPACE:{"id":"<workspace id>","pinned":true}]]
[[PIN_AGENT:{"id":"<agent id>","pinned":true}]]
[[SET_SETTING:{"key":"render_typst","value":true}]]
[[E2EE_ASSIGN:{"modelId":"<model id>","key":"<key name or key id>"}]]
[[E2EE_ASSIGN:{"modelId":"<model id>","key":null}]]
[[SET_CONVERSATION_SETTING:{"target":"all","key":"temperature","value":0.7}]]
[[SET_CONVERSATION_SETTING:{"id":"<conversation id>","key":"temperature","value":0.7}]]
[[MCP_SERVER:{"op":"add","server":"local","target":"all","url":"localhost:9000","enabled":true}]]
[[MCP_SERVER:{"op":"update","server":"local","target":"all","url":"localhost:9000","enabled":false}]]
[[MCP_SERVER:{"op":"remove","server":"local","target":"<conversation id>","url":"localhost:9000"}]]
[[AGENT_ACTION:{"op":"prompt","agent":"<agent id>","text":"<prompt text>"}]]
[[AGENT_ACTION:{"op":"interrupt","agent":"<agent id>"}]]
[[AGENT_SESSION:{"op":"create","agent":"<agent id>","title":"<optional title>"}]]
[[AGENT_SESSION:{"op":"switch","agent":"<agent id>","sessionId":"<session id>"}]]
[[AGENT_SESSION:{"op":"delete","agent":"<agent id>","sessionId":"<session id>"}]]
[[WORKSPACE_LINK:{"op":"attach","workspaceId":"<workspace id>","agentId":"<agent id>"}]]
[[WORKSPACE_LINK:{"op":"detach","workspaceId":"<workspace id>","conversationId":"<conversation id>"}]]
[[MCP_SERVER:{"op":"add","server":"local","target":"global","name":"<name>","url":"localhost:9000"}]]
[[MCP_SERVER:{"op":"update","server":"local","target":"global","entryId":"<server entry id>","name":"<new name>"}]]
[[MCP_SERVER:{"op":"remove","server":"local","target":"global","entryId":"<server entry id>"}]]
[[ADD_MEMORY:{"text":"<new memory>","group":"<group name>"}]]
[[UPDATE_MEMORY:{"index":0,"text":"<updated memory>","group":"<group name>"}]]
[[DELETE_MEMORY:{"index":0}]]
[[CLEAR_MEMORIES:{}]]

Use only ids returned by the tools. Use "folderId": null for Unsorted, or provide a new folderName to create a topic. Use "pinned": true to pin a chat, topic, workspace, or agent and "pinned": false to unpin it; pinned items appear in the top-level pinned section of the sidebar. CREATE_CHAT messages must be text-only, use only system/user/assistant roles, and total at most 200 messages. Settings are optional and are validated before the chat is created. Use MCP_SERVER "target":"global" to change the sidebar MCP server list; get the entryId from get_user_settings. Use list_e2ee_keys before E2EE_ASSIGN and use an existing key name or id; "key": null stops encrypting that model. Encrypting a model only works after its public key was imported, and E2EE_ASSIGN never imports a key. Use list_workspaces before WORKSPACE_LINK or PIN_WORKSPACE and provide exactly one of agentId or conversationId for the link. Use list_agents before AGENT_ACTION or PIN_AGENT; prompt and interrupt actions cannot be reverted. list_workspaces and list_agents return each item's creation time, modification time, and pinned state, so use those values when the user asks when something was created or last changed. Use list_agent_sessions before AGENT_SESSION and get the session id from that tool; AGENT_SESSION can create a new top-level session, switch the agent to an existing session or subagent session, or delete a session when the user explicitly asks to remove it. Deleting a session cannot be reverted. Use get_agent_history with a session id or title to read a specific session. To link to an agent, call list_agents and use [Agent name](/agent/<agent id>). To download or display a file from an agent, call list_agent_files and then fetch_agent_file; that attaches the file to this Meta chat. Use read_agent_file only for text. Do not claim that binary files cannot be accessed or shown. When the user asks what is new, which files are new, or for recent activity, use get_whats_new with the last-check timestamp supplied in the system context. Report changed chats, new topics/memories, agent status, new or changed sessions and subagent sessions, and recently modified agent files with their agents.

Supported setting keys and values:
- memory_mode: 0 (none), 1 (recall), 2 (learn)
- suggest_user_prompts, html_load_external, set_title_once, render_typst, render_latex, render_graphviz, render_vega, render_chartjs, conversation_summaries: true or false
- html_render_mode: "render", "code", or "off"
- html_sanitization: "strict" or "relaxed"
- document_conversion_mode: "server", "browser", or "choice"
- mcp_tool_policy: "ask", "always", or "never" (whether chat turns may call tools of the user's MCP servers; "never" leaves the app's own file and workspace tools available)
- sync_enabled, sync_auto: true or false (the encrypted server synchronization and its automatic five-minute pass; enabling it only switches the preference, the vault is created or unlocked in Data settings and the passphrase is never available here)
- send_with_enter: true, false, or null
- timeout: milliseconds (5000-900000)

Supported per-chat setting keys and values:
- model: a model id from list_models
- temperature, top_p: number from 0 to 2
- reasoning_effort: number or null
- memory_mode_override: "default", 0, 1, or 2
- enable_tools, enable_web_search: true or false
- browser_storage: true or false (agent mode: lets the agent read and write this chat's browser workspace)
- workspace_write_access: true or false (agent mode: lets the agent change files in the workspaces attached to this chat; a chat without an attached workspace always writes in its own storage)
- arcana_tools: true or false (lets the assistant inspect Arcana collections, their files, indexes, and sharing)
- arcana_share: a collection reference "<owner>__<name>" or null (wires this chat to that shared collection with the read-only search_arcana, list_arcana_documents and read_arcana_document tools)

Use SET_CONVERSATION_SETTING with "target":"all" only when the user explicitly asks to change all chats; otherwise use a conversation id from list_chats. The Meta chat's own settings are read-only.

MCP servers connect from the browser to a URL. Every server is a "local" server: provide its URL (for example localhost:9000). The target is "all" or a conversation id; use "all" when the user does not name a chat. authorization is optional and must only contain a value the user gave you; never invent credentials.

For any other setting, do not propose a marker; use get_user_settings to find the relevant settings tab and give its deep link instead. Use list_memories before ADD_MEMORY, UPDATE_MEMORY, DELETE_MEMORY, or CLEAR_MEMORIES; indices come from that tool. Memories can be grouped: set group to an existing group name from list_memories, or omit it to use this chat's effective memory group. Never invent a group name. Do not combine proposal markers with persona links or tutorial requests in the same answer.

Answer in the same language as the user's question. Be concise and concrete.`;

  // A deployment can switch the tour runtime off; then the Meta chat must not
  // promise a walkthrough it cannot start.
  if (isFeatureEnabled("tutorials")) return prompt;
  return `${prompt}

Feature guides and use-case walkthroughs are disabled in this deployment: do not call start_tutorial or start_use_case, do not offer /tutorial/ or /use-case/ links, and tell the user that guided tours are unavailable.`;
}

export function useMetaChatSend(modelsData = []) {
  const dispatch = useDispatch();
  const timeout = useSelector(selectTimeout);
  const userSettings = useSelector(selectUserSettings);
  const interfaceSettings = useSelector((state) => state.interface_settings);
  const memories = useSelector(selectAllMemories);
  const memoryGroups = useSelector(selectMemoryGroups);
  const defaultMemoryGroup = useSelector(selectDefaultMemoryGroup);
  const memoryMode = useSelector(selectMemoryMode);
  const { t } = useTranslation();
  const { notifySuccess } = useToast();

  return useCallback(
    async ({ localState, setLocalState }) => {
      if (!setLocalState) return;

      const modeOverride = localState.settings?.memory_mode_override;
      const effectiveMemoryMode =
        modeOverride === undefined ||
        modeOverride === null ||
        modeOverride === "default"
          ? memoryMode
          : [0, 1, 2].includes(Number(modeOverride))
            ? Number(modeOverride)
            : memoryMode;

      const groupOverride = localState.settings?.memory_group_override;
      const requestedGroup =
        groupOverride && groupOverride !== "default"
          ? groupOverride
          : defaultMemoryGroup;
      const effectiveMemoryGroup =
        requestedGroup === "default" ||
        memoryGroups.some((group) => group.id === requestedGroup)
          ? requestedGroup
          : "default";
      const groupMemories = (memories || []).filter(
        (memory) => (memory.groupId ?? "default") === effectiveMemoryGroup,
      );

      const modelId =
        (typeof localState.settings?.model === "string"
          ? localState.settings.model
          : localState.settings?.model?.id) ||
        getDefaultChatAIModel(userSettings);
      if (!modelId) {
        setLocalState((prev) => {
          const now = Date.now();
          const messages = [...prev.messages];
          const lastIndex = messages.length - 1;
          if (messages[lastIndex]?.role === "user" && !messages[lastIndex].createdAt) {
            messages[lastIndex] = { ...messages[lastIndex], createdAt: now };
          }
          return {
            ...prev,
            messages: [
              ...messages,
              {
                role: "assistant",
                content: [{ type: "text", text: "" }],
                loading: false,
                meta: { error: t("meta_chat.no_model") },
                createdAt: now,
              },
              { role: "user", content: [{ type: "text", text: "" }] },
            ],
          };
        });
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

      const newUserMessage = extractMessageText(
        localState.messages[localState.messages.length - 1],
      ).trim();
      const asksForNew =
        /\b(what'?s new|anything new|any news|any updates?|recent activity|recent changes|new in meta|neuigkeiten|was gibt'?s neues|irgendetwas neues)\b/i.test(
          newUserMessage,
        );
      const asksForAgentStatus =
        /\b(agent status|status of (?:the )?agents?|aktivität der agenten|status der agenten)\b/i.test(
          newUserMessage,
        );
      let systemPrompt = buildSystemPrompt();
      let whatsNewResult = "";
      const metaCheckStartedAt = Date.now();
      if (asksForNew) {
        let lastCheck = 0;
        try {
          lastCheck = Number(localStorage.getItem(META_LAST_CHECK_KEY)) || 0;
        } catch {}
        const since = lastCheck || metaCheckStartedAt - 24 * 60 * 60 * 1000;
        const changes = await runTool("get_whats_new", {
          since: new Date(since).toISOString(),
        });
        whatsNewResult = String(changes);
        systemPrompt += `\n\nChanges checked at ${new Date(metaCheckStartedAt).toISOString()} since ${new Date(since).toISOString()}:\n${changes}`;
      } else if (asksForAgentStatus) {
        const status = await runTool("check_agents");
        systemPrompt += `\n\nCurrent agent status (checked now with check_agents):\n${status}`;
      }

      const payload = {
        settings: {
          model: { id: modelId, name: modelId },
          temperature: localState.settings?.temperature ?? 0.5,
          top_p: localState.settings?.top_p ?? 0.5,
          enable_tools: false,
          tools: {},
          ...(modelSupportsTools({ id: modelId })
            ? {
                function_tools: getMetaToolDefinitions(),
                tool_choice: "auto",
              }
            : {}),
        },
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
        ],
      };

      const conversationId = localState.id;
      const timeoutMs =
        timeout >= 5000 && timeout <= 900000 ? timeout : 300000;

      setLocalState((prev) => {
        const now = Date.now();
        const messages = [...prev.messages];
        const lastIndex = messages.length - 1;
        if (messages[lastIndex]?.role === "user" && !messages[lastIndex].createdAt) {
          messages[lastIndex] = { ...messages[lastIndex], createdAt: now };
        }
        return {
          ...prev,
          messages: [
            ...messages,
            {
              role: "assistant",
              content: [{ type: "text", text: "" }],
              loading: true,
              createdAt: now,
            },
            { role: "user", content: [{ type: "text", text: "" }] },
          ],
        };
      });

      let accumulated = "";
      const fileAttachments = [];
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
            content: [
              { type: "text", text: accumulated },
              ...fileAttachments,
            ],
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
              if (result?.attachment) {
                try {
                  const bytes = Uint8Array.from(
                    atob(result.attachment.base64),
                    (character) => character.charCodeAt(0),
                  );
                  const file = new File(
                    [bytes],
                    result.attachment.name,
                    { type: result.attachment.mime },
                  );
                  const fileId = await saveFileReady(conversationId, file);
                  fileAttachments.push({ type: "file", fileId });
                  result =
                    result.summary || `Attached ${result.attachment.name}.`;
                  updateAssistant();
                } catch (attachError) {
                  result = `Could not attach the file: ${attachError.message}`;
                }
              }
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
          const content = [
            ...(finalText ? [{ type: "text", text: finalText }] : []),
            ...fileAttachments,
          ];
          messages[index] = {
            ...messages[index],
            content: content.length ? content : messages[index].content,
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

        if (asksForNew && !errorMeta) {
          try {
            localStorage.setItem(
              META_LAST_CHECK_KEY,
              String(metaCheckStartedAt),
            );
            localStorage.setItem(
              META_LAST_CHECK_RESULT_KEY,
              JSON.stringify({
                at: metaCheckStartedAt,
                text: whatsNewResult,
              }),
            );
            window.dispatchEvent(
              new CustomEvent("chatai:meta-last-check", {
                detail: { at: metaCheckStartedAt },
              }),
            );
          } catch {}
        }
        window.dispatchEvent(new Event("chatai:message-complete"));
      }

      if (
        effectiveMemoryMode === 2 &&
        newUserMessage &&
        accumulated.trim() &&
        !errorMeta
      ) {
        try {
          const memoryResponse = await generateMemory(
            newUserMessage,
            groupMemories,
          );
          const cleanedResponse = memoryResponse.replace(
            /,(\s*[}$])/g,
            "$1",
          );
          const jsonResponse = JSON.parse(cleanedResponse);
          if (jsonResponse.store) {
            const memoryText = jsonResponse.memory_sentence.trim();
            if (jsonResponse.replace) {
              const lineNumber = jsonResponse.line_number - 1;
              dispatch(
                editMemory({
                  index: lineNumber,
                  text: memoryText,
                  groupId: effectiveMemoryGroup,
                }),
              );
            } else {
              dispatch(
                addMemory({
                  text: memoryText,
                  groupId: effectiveMemoryGroup,
                }),
              );
            }
            notifySuccess("Memory updated successfully.");
          }
        } catch (error) {
          console.error("Meta chat memory update failed", error);
        }
      }
    },
    [
      timeout,
      userSettings,
      interfaceSettings,
      memories,
      memoryGroups,
      defaultMemoryGroup,
      memoryMode,
      dispatch,
      notifySuccess,
      modelsData,
      t,
    ],
  );
}
