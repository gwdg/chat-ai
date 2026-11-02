import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../hooks/useToast";
// Hooks


import { updateConversation } from "../../db";

import BaseModal from "../BaseModal";

export default function ConversationConflict({ isOpen, onClose, localState, setLocalState, setUnsavedChanges }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useToast();

  const handleOverwrite = async () => {
    // Force save
    const lastModified = await updateConversation(localState.id, localState, true);
    localState.lastModified = lastModified;
    setUnsavedChanges(false);
    onClose();
  }
  const handleReload = () => {
    navigate(0)
    onClose();
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="alert.title"
    >
      {/* Message */}
      <div className="pt-0 pb-2">
        <p className="dark:text-white text-black text-justify text-sm">
          Conversation was changed by another tab or process. Would you like to overwrite, or reload the conversation?
        </p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm mt-2">
        {/* Reload button */}
        <button
          className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
          onClick={handleReload}
        >
          Reload
        </button>

        {/* Overwrite button */}
        <button
          className="text-white p-3 bg-red-600 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
          onClick={handleOverwrite}
        >
          Overwrite
        </button>
      </div>
    </BaseModal>
  );
}
