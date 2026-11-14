import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import { attachWorkspaceChat } from "../../db/workspaceDb";

export default function AttachChatModal({
  isOpen,
  onClose,
  workspaceId,
  conversations = [],
  attachedIds = [],
  onAdded,
}) {
  const { t } = useTranslation();
  const attached = useMemo(() => new Set(attachedIds), [attachedIds]);
  const available = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          conversation?.id &&
          !conversation.isMetaChat &&
          conversation.id !== "meta-chat" &&
          !attached.has(conversation.id),
      ),
    [conversations, attached],
  );
  const [conversationId, setConversationId] = useState(available[0]?.id ?? "");

  const submit = async () => {
    if (!conversationId) return;
    await attachWorkspaceChat(workspaceId, conversationId);
    onAdded?.(conversationId);
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="workspace.attach_chat">
      <div className="flex flex-col gap-3 pb-2 text-sm">
        <p className="text-xs text-base-content/70">
          {t("workspace.attach_chat_hint")}
        </p>
        {available.length === 0 ? (
          <p className="text-xs text-base-content/60">
            {t("workspace.no_attached_chats")}
          </p>
        ) : (
          <select
            value={conversationId}
            onChange={(event) => setConversationId(event.target.value)}
            className="select select-bordered w-full"
          >
            {available.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.title || conversation.id}
              </option>
            ))}
          </select>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={submit}
            disabled={!conversationId}
          >
            {t("workspace.attach_chat")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
