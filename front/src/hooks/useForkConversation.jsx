import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { createConversation, newId, saveFile, loadFile } from "../db";
import { useToast } from "./useToast";

// Deep-clone a message's content, duplicating any attached files so the
// forked conversation owns its own copies (independent of the source).
async function cloneMessageContent(content, targetConversationId) {
  const items = Array.isArray(content)
    ? content
    : typeof content === "string"
      ? [{ type: "text", text: content }]
      : [];
  const clonedContent = [];
  for (const item of items) {
    if (item?.type === "file" && item?.fileId) {
      try {
        const file = await loadFile(item.fileId);
        if (file) {
          const newFileId = saveFile(targetConversationId, file);
          clonedContent.push({ type: "file", fileId: newFileId });
        }
      } catch (error) {
        console.warn("Failed to clone attachment", error);
      }
      continue;
    }
    if (item?.type) {
      clonedContent.push({ ...item });
    } else if (item?.text) {
      clonedContent.push({ type: "text", text: item.text });
    } else {
      clonedContent.push({ type: "text", text: "" });
    }
  }
  if (clonedContent.length === 0) {
    return [{ type: "text", text: "" }];
  }
  return clonedContent;
}

// Fork the conversation described by `localState` up to (and including)
// `message_index` into a brand-new conversation, then navigate to it.
export function useForkConversation(localState) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const [forking, setForking] = useState(false);

  const forkConversation = useCallback(
    async (message_index) => {
      if (forking) return;
      try {
        setForking(true);
        const sourceMessages =
          localState?.messages?.slice(0, message_index + 1) || [];
        if (sourceMessages.length === 0) {
          notifyError(t("conversation.fork_empty"));
          return;
        }

        const newConversationId = newId();
        const forkMessages = [];
        for (const msg of sourceMessages) {
          if (!msg?.role) continue;
          const clonedContent = await cloneMessageContent(
            msg.content,
            newConversationId
          );
          forkMessages.push({
            role: msg.role,
            content: clonedContent,
            meta: msg.meta,
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt,
          });
        }

        if (forkMessages[forkMessages.length - 1]?.role !== "user") {
          forkMessages.push({
            role: "user",
            content: [{ type: "text", text: "" }],
          });
        }

        const baseTitle = localState?.title?.trim();
        const forkTitle = baseTitle
          ? baseTitle.endsWith(" (Fork)")
            ? baseTitle
            : `${baseTitle} (Fork)`
          : "Forked Conversation";

        const settingsClone = JSON.parse(
          JSON.stringify(localState?.settings || {})
        );

        await createConversation({
          id: newConversationId,
          title: forkTitle,
          settings: settingsClone,
          messages: forkMessages,
          folderId: localState?.folderId ?? null,
        });

        notifySuccess(t("conversation.fork_created"));
        navigate(`/chat/${newConversationId}`);
      } catch (error) {
        console.error("Failed to fork conversation", error);
        notifyError(t("conversation.fork_failed"));
      } finally {
        setForking(false);
      }
    },
    [forking, localState, navigate, notifyError, notifySuccess, t]
  );

  return { forkConversation, forking };
}
