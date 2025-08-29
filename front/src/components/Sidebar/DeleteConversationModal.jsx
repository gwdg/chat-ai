import { Trans } from "react-i18next";
import BaseModal from "../../modals/BaseModal";
import {
  selectConversations,
  selectCurrentConversationId,
} from "../../Redux/reducers/conversationsSlice";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { persistor } from "../../Redux/store/store";
import { createConversation, deleteConversation } from "../../db";
import { getDefaultConversation } from "../../utils/conversationUtils";

export default function DeleteConversationModal({
  id,
  conversations,
  currentConversationId,
  isOpen,
  onClose,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  async function handleDelete() {
    const currentIndex = conversations.findIndex((conv) => conv.id === id);
    // If conversation not found, do nothing
    if (currentIndex === -1) return;

    // If this is the only conversation, create a new one
    if (conversations.length === 1) {
      console.log("Only one conversation, creating a new one.");
      
      const newConversationId = await createConversation(getDefaultConversation());
      console.log("Created new conversation with id:", newConversationId);
      navigate(`/chat/${newConversationId}`);
      // const action = dispatch(addConversation());
      // nextConversationId = action.payload.id;
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
      titleKey="description.delete_title"
      maxWidth="max-w-md"
    >
      {/* Warning Message */}
      <div className="pt-0 pb-2">
        <p className="dark:text-white text-black text-justify text-sm">
          <Trans i18nKey="description.delete_message" />
        </p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm">
        {/* Cancel Button */}
        <button
          className="cursor-pointer px-5 py-3 rounded-lg font-medium 
                    text-gray-700 bg-gray-200 border border-gray-300 
                    hover:bg-gray-300 hover:border-gray-400 
                    active:scale-95 transition-all duration-200 
                    dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 
                    dark:hover:bg-gray-600"
          onClick={onClose}
        >
          <Trans i18nKey="description.delete_cancelText" />
        </button>

        {/* Delete Button */}
        <button
          className="cursor-pointer px-5 py-3 rounded-lg font-medium 
                    text-white bg-red-600 border border-red-700 
                    hover:bg-red-700 hover:border-red-800 
                    active:scale-95 transition-all duration-200 shadow-md 
                    dark:shadow-black/30"
          onClick={handleDelete}
        >
          <Trans i18nKey="description.delete_confirmText" />
        </button>
      </div>
    </BaseModal>
  );
}
