import { Trans } from "react-i18next";
import BaseModal from "../../../modals/BaseModal";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { createConversation, deleteConversation } from "../../../db";
import { getDefaultConversation } from "../../../utils/conversationUtils";
import { selectUserSettings } from "../../../Redux/reducers/userSettingsReducer";

export default function DeleteChatModal({
  id,
  conversations,
  currentConversationId,
  isOpen,
  onClose,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const userSettings = useSelector(selectUserSettings);

  async function handleDelete() {
    const currentIndex = conversations.findIndex((conv) => conv.id === id);
    // If conversation not found, do nothing
    if (currentIndex === -1) return;

    // If this is the only conversation, create a new one
    if (conversations.length === 1) {
      console.log("Only one conversation, creating a new one.");
      
      const folderId = conversations[currentIndex]?.folderId || null;
      const newConversationId = await createConversation(getDefaultConversation(userSettings, folderId));
      console.log("Created new conversation with id:", newConversationId);
      navigate(`/chat/${newConversationId}`);
    }

    // If deleting current conversation
    if (id === currentConversationId) {
      console.log("Current conversation deleted")
      //navigate to base page and logic there decide which page to show
      navigate(`/chat/`);
    }
    deleteConversation(id);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="delete_conversation.title"
      maxWidth="max-w-md"
    >
      {/* Warning Message */}
      <div className="pt-0 pb-2">
        <p className="text-base-content text-justify text-sm">
          <Trans i18nKey="delete_conversation.description" />
        </p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm">
        {/* Cancel Button */}
        <button
          className="btn"
          onClick={onClose}
        >
          <Trans i18nKey="common.cancel" />
        </button>

        {/* Delete Button */}
        <button
          className="btn btn-error"
          onClick={handleDelete}
        >
          <Trans i18nKey="common.delete" />
        </button>
      </div>
    </BaseModal>
  );
}
