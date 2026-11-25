import { useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { createAttachedChat } from "../../db/workspaceDb";
import { getDefaultConversation } from "../../utils/conversationUtils";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";
import { useToast } from "../../hooks/useToast";
import Prompt from "../Prompt/Prompt";

/**
 * Prompt box for the workspace home view.
 *
 * It renders the regular chat Prompt so every control (attachments, settings,
 * model, tools, send) behaves exactly as in a chat. Only the placeholder
 * differs. Sending hands the text and any attachments to a new chat attached
 * to this workspace through router state (see usePendingPrompt), keeping the
 * normal streaming, autosave and title-generation pipeline as the single send
 * path.
 */
export default function WorkspaceComposer({
  workspaceId,
  workspaceName,
  draftState,
  setDraftState,
  userData,
  modelsData,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifyError } = useToast();
  const userSettings = useSelector(selectUserSettings);
  const sendingRef = useRef(false);

  const sendMessage = useCallback(
    async ({ localState }) => {
      if (sendingRef.current) return;
      const messages = Array.isArray(localState?.messages)
        ? localState.messages
        : [];
      const lastMessage = messages[messages.length - 1];
      const content = Array.isArray(lastMessage?.content)
        ? lastMessage.content
        : [];
      const text = typeof content[0]?.text === "string" ? content[0].text : "";
      const attachments = content.slice(1);
      if (!text.trim() && attachments.length === 0) return;

      sendingRef.current = true;
      const conversation = getDefaultConversation(userSettings, null);
      // Attachments are stored against the draft's id, so the new chat must
      // keep it or they would be orphaned.
      conversation.id = localState?.id ?? conversation.id;
      conversation.settings = {
        ...conversation.settings,
        ...(localState?.settings ?? {}),
      };

      try {
        await createAttachedChat(workspaceId, conversation);
        navigate(`/chat/${conversation.id}`, {
          state: {
            pendingPrompt: text,
            pendingAttachments: attachments,
            openWorkspacePanel: true,
          },
        });
      } catch (error) {
        sendingRef.current = false;
        console.error("Failed to start a chat in this workspace", error);
        notifyError(t("topic_view.create_error"));
      }
    },
    [workspaceId, navigate, notifyError, t, userSettings],
  );

  return (
    <Prompt
      localState={draftState}
      setLocalState={setDraftState}
      userData={userData}
      modelsData={modelsData}
      sendMessage={sendMessage}
      placeholder={t("workspace.composer_placeholder", {
        name: workspaceName,
      })}
    />
  );
}
