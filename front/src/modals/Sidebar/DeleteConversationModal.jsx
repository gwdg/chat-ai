import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";
import { addConversation, deleteConversation, selectConversations, selectCurrentConversationId } from "../../Redux/reducers/conversationsSlice";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { persistor } from "../../Redux/store/store";


export default function DeleteConversationModal({
  isOpen,
  onClose,
  id,
}) {
  const conversations = useSelector(selectConversations);
  const currentConversationId = useSelector(selectCurrentConversationId);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Updated confirmDelete function
    const handleDelete = () => {
      const currentIndex = conversations.findIndex((conv) => conv.id === id);
      if (currentIndex !== -1) {
        if (id === currentConversationId) {
          const isFirstConversation = currentIndex === 0;
          const nextConversationIndex = isFirstConversation
            ? 1
            : currentIndex - 1;
  
          if (conversations.length === 1) {
            // Create new conversation with a known ID before deleting the last one
            const newConversationId = uuidv4();
  
            // First create the new conversation to ensure it exists
            dispatch(addConversation(newConversationId));
  
            // Then navigate to it
            navigate(`/chat/${newConversationId}`);
  
            // Force persistence to ensure other tabs pick up the change
            persistor.flush().then(() => {
              // Then delete the old conversation
              setTimeout(() => {
                dispatch(deleteConversation(id));
              }, 100);
            });
          } else {
            // Navigate to adjacent conversation before deleting
            const nextConversationId = conversations[nextConversationIndex].id;
            navigate(`/chat/${nextConversationId}`);
            dispatch(deleteConversation(id));
          }
        } else {
          dispatch(deleteConversation(id));
        }
      }
      onClose();
    }

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
          className="px-5 py-3 rounded-lg font-medium 
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
          className="px-5 py-3 rounded-lg font-medium 
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