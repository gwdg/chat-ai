import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { chatCompletions } from "../apis/chatCompletions";
import { useToast } from "./useToast";
import generateMemory from "../apis/generateMemory";
import { listConversationMetas, listFolders } from "../db";
import { extractMessageText } from "../utils/conversationSummary";
import { getDefaultChatAIModel } from "../utils/conversationUtils";
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

const MAX_CONVERSATIONS = 400;
const MAX_CONTEXT_CHARS = 60000;
const MAX_MEMORY_CHARS = 12000;

function buildSystemPrompt(conversations, topics, memories, memoryMode) {
  const topicById = new Map(
    topics.map((topic) => [topic.id, topic.name]),
  );
  const topicLines = topics
    .map((topic) => `- id: ${topic.id}\n  name: ${topic.name}`)
    .join("\n") || "(no topics available)";
  let used = topicLines.length;
  const lines = [];

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

  return `You are the Meta chat assistant for a local chat application. You help the user find and understand their past conversations and topics.

You receive metadata for the user's conversations and topics (categories). Each conversation has an id, title, topic, summary, and last-modified time. This metadata and any saved memories are your only sources. Summaries may be missing or stale. Never invent a conversation, topic, title, id, summary, or memory.

Use the topic tree to answer questions about which topic or category contains something. When naming a topic, use its exact name.

When you refer to a conversation, always link to it using exactly this Markdown form:
[<conversation title>](/chat/<conversation id>)
Use only ids from the list below. Do not link to any other URL or invent an id. If nothing matches the user's question, say so plainly.

Answer in the same language as the user's question. Be concise and concrete.

You may also receive the user's saved memories. Use them when relevant, but they may be stale. Never invent memories.

${
    memoryMode === 2
      ? "Memory learning is enabled for this chat. The application may save relevant new personal information from the user's messages after your reply. You do not write memories yourself; never tell the user that you only have read access."
      : memoryMode === 1
        ? "Memory recall is enabled for this chat. Memories are read-only and new information is not saved."
        : "Memory use is disabled for this chat. Do not claim to remember or store anything."
  }

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
  const [rows, folders] = await Promise.all([
    listConversationMetas(),
    listFolders(),
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

  return { conversations, topics };
}

export function useMetaChatSend() {
  const dispatch = useDispatch();
  const timeout = useSelector(selectTimeout);
  const userSettings = useSelector(selectUserSettings);
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
        (memory) =>
          (memory.groupId ?? "default") === effectiveMemoryGroup,
      );

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
      try {
        ({ conversations, topics } = await loadMetaContext());
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
          content: extractMessageText(message).trim(),
        }))
        .filter((message) => message.content.length > 0);

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
              effectiveMemoryMode !== 0
                ? groupMemories.map((memory) => memory?.text || "")
                : [],
              effectiveMemoryMode,
            ),
          },
          ...history,
        ],
      };

      const conversationId = localState.id;
      const newUserMessage = extractMessageText(
        localState.messages[localState.messages.length - 1],
      ).trim();
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
          messages[index] = {
            ...messages[index],
            content: accumulated
              ? [{ type: "text", text: accumulated }]
              : messages[index].content,
            loading: false,
            ...(errorMeta ? { meta: errorMeta } : {}),
          };
          return { ...prev, messages };
        });
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
      memories,
      memoryGroups,
      defaultMemoryGroup,
      memoryMode,
      dispatch,
      notifySuccess,
      t,
    ],
  );
}
