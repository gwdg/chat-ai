import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { chatCompletions } from "../apis/chatCompletions";
import { modelSupportsTools } from "../apis/agentEndpoints";
import { useToast } from "./useToast";
import { extractMessageText } from "../utils/conversationSummary";
import { getDefaultChatAIModel } from "../utils/conversationUtils";
import {
  buildArcanaChatSystemPrompt,
  createArcanaChatToolRunner,
  getArcanaChatToolDefinitions,
} from "../utils/arcanaChat";
import {
  appendArcanaActionMarkers,
  arcanaActionKey,
  stripArcanaActionMarkers,
} from "../utils/arcanaActions";
import {
  appendArcanaDocumentMarkers,
  stripArcanaDocumentMarkers,
} from "../utils/arcanaDocuments";
import { loadFile } from "../db";
import {
  selectTimeout,
  selectUserSettings,
} from "../Redux/reducers/userSettingsReducer";

const MAX_TOOL_ROUNDS = 6;

/**
 * Read the files attached to the user's current message.
 *
 * The model gets their names and sizes in the prompt, and the upload tool gets
 * the actual bytes from IndexedDB, so a document never has to travel through
 * the model's context.
 */
async function readAttachments(localState) {
  const messages = localState?.messages ?? [];
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const items = Array.isArray(lastUser?.content) ? lastUser.content : [];
  const rows = [];
  for (const item of items) {
    if (item?.type !== "file" || !item.fileId) continue;
    try {
      const file = await loadFile(item.fileId);
      if (file) rows.push({ fileId: item.fileId, name: file.name, file });
    } catch {
      // A file whose bytes are gone simply cannot be uploaded; the tool says
      // which attachments are available.
    }
  }
  return rows;
}

export function useArcanaChatSend(collection) {
  const { t } = useTranslation();
  const timeout = useSelector(selectTimeout);
  const userSettings = useSelector(selectUserSettings);
  const { notifyError } = useToast();

  return useCallback(
    async ({ localState, setLocalState }) => {
      if (!setLocalState) return;
      if (!collection) return;

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
              meta: { error: t("arcana_chat.no_model") },
              createdAt: Date.now(),
            },
            { role: "user", content: [{ type: "text", text: "" }] },
          ],
        }));
        return;
      }

      if (!modelSupportsTools({ id: modelId })) {
        setLocalState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              content: [{ type: "text", text: "" }],
              loading: false,
              meta: { error: t("arcana_chat.no_tools") },
              createdAt: Date.now(),
            },
            { role: "user", content: [{ type: "text", text: "" }] },
          ],
        }));
        return;
      }

      const attachments = await readAttachments(localState);
      const history = localState.messages
        .filter(
          (message) => message.role === "user" || message.role === "assistant",
        )
        .map((message) => ({
          role: message.role,
          content: stripArcanaDocumentMarkers(
            stripArcanaActionMarkers(extractMessageText(message)),
          ).trim(),
        }))
        .filter((message) => message.content.length > 0);

      const newUserMessage = extractMessageText(
        localState.messages[localState.messages.length - 1],
      ).trim();
      if (!newUserMessage) return;

      let systemPrompt = buildArcanaChatSystemPrompt(collection);
      if (attachments.length) {
        systemPrompt += `\n\nFiles the user attached to this message (upload_attachment can store one of them):\n${attachments
          .map(
            (attachment) =>
              `- ${attachment.name} (${attachment.file.size} bytes)`,
          )
          .join("\n")}`;
      }

      const runner = createArcanaChatToolRunner({ collection, attachments });

      const payload = {
        settings: {
          model: { id: modelId, name: modelId },
          temperature: localState.settings?.temperature ?? 0.5,
          top_p: localState.settings?.top_p ?? 0.5,
          enable_tools: false,
          tools: {},
          function_tools: getArcanaChatToolDefinitions(collection),
          tool_choice: "auto",
        },
        messages: [{ role: "system", content: systemPrompt }, ...history],
      };

      const chatId = localState.id;
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
      const proposals = [];
      const proposedKeys = new Set();
      let errorMeta = null;

      // The helper drops any marker-shaped text the model wrote itself, so only
      // a proposal or citation this app captured can reach its card.
      const composed = () =>
        appendArcanaDocumentMarkers(
          appendArcanaActionMarkers(accumulated.trim(), proposals).trim(),
          runner.getDocuments(),
        ).trim();

      const updateAssistant = () =>
        setLocalState((prev) => {
          if (prev.id !== chatId) return prev;
          const messages = [...prev.messages];
          const index = messages.length - 2;
          if (messages[index]?.role !== "assistant") return prev;
          messages[index] = {
            ...messages[index],
            content: [{ type: "text", text: composed() }],
          };
          return { ...prev, messages };
        });

      // The app, not the model, writes the approval markers, so the proposal a
      // tool captured is what the card below the answer reads. A model that
      // repeats a call does not add a second card row.
      const collectProposals = () => {
        let added = false;
        for (const action of runner.takeProposals()) {
          const key = arcanaActionKey(action);
          if (proposedKeys.has(key)) continue;
          proposedKeys.add(key);
          proposals.push(action);
          added = true;
        }
        if (added) updateAssistant();
      };

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
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
              if (call.function?.name) {
                entry.function.name = call.function.name;
              }
              if (call.function?.arguments) {
                entry.function.arguments += call.function.arguments;
              }
            }
          }

          const calls = toolCalls.filter(Boolean);
          if (!calls.length) break;

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
              result = await runner.run(call.function.name, args);
            } catch (toolError) {
              result = `Tool error: ${toolError?.message || String(toolError)}`;
            }
            payload.messages.push({
              role: "tool",
              tool_call_id: call.id,
              content:
                typeof result === "string" ? result : JSON.stringify(result),
            });
          }

          collectProposals();
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("Arcana chat failed", error);
          errorMeta = { error: error?.message || t("arcana_chat.error") };
        }
      } finally {
        setLocalState((prev) => {
          if (prev.id !== chatId) return prev;
          const messages = [...prev.messages];
          const index = messages.length - 2;
          if (messages[index]?.role !== "assistant") return prev;
          if (!messages[index].loading) return prev;
          const text = composed() || (errorMeta ? "" : t("arcana_chat.done"));
          messages[index] = {
            ...messages[index],
            content: [{ type: "text", text }],
            loading: false,
            ...(errorMeta ? { meta: errorMeta } : {}),
          };
          return { ...prev, messages };
        });

        if (errorMeta) notifyError(errorMeta.error);
        window.dispatchEvent(new Event("chatai:message-complete"));
      }
    },
    [collection, notifyError, t, timeout, userSettings],
  );
}
