import { Trans } from "react-i18next";
import store, { persistor } from "../../Redux/store/store";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../hooks/useToast";
import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
// Hooks
import { getDefaultConversation, getDefaultSettings } from "../../utils/conversationUtils";
import { createConversation, resetDB } from "../../db";

import BaseModal from "../BaseModal";
import { selectCurrentConversationId } from "../../Redux/reducers/conversationsSlice";
import { setCurrentConversation } from "../../Redux/reducers/currentConversationSlice";

export default function ClearCacheModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useToast();
  const currentConversationId = useSelector(selectCurrentConversationId);
  const [isCleared, setIsCleared] = useState(false);

  // Navigate to the current conversation after clearing cache
  useEffect(() => {
    if (!isCleared) return;
    if (currentConversationId) {
      navigate(`/chat/${currentConversationId}`, { replace: true });
    }
    notifySuccess("Chats cleared successfully");
    onClose();
  }, [currentConversationId]);

  const clearCache = useCallback(async () => {
    try {
      // Save the current state BEFORE purging (this is crucial)
      // const currentState = store.getState();
      // await persistor.purge();
      // Dispatch RESET_ALL
      // Prepare to navigate
      setIsCleared(true); 
      await resetDB();
      await dispatch({
        type: "RESET_ALL",
        meta: {
          sync: true,
        },
      });
      const newConversationId = await createConversation(getDefaultConversation());
      console.log("New conversation", newConversationId)
      navigate(`/chat/${newConversationId}`, { replace: true });
    } catch (error) {
      notifyError("Failed to clear chats: " + error.message);
    }
  }, [dispatch, notifySuccess, notifyError]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="description.help_title1"
    >
      {/* Message */}
      <div className="pt-0 pb-2">
        <p className="dark:text-white text-black text-justify text-sm">
          <Trans i18nKey="description.cache1" />
        </p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm mt-2">
        {/* Cancel button */}
        <button
          className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
          onClick={onClose}
        >
          <Trans i18nKey="description.cache2" />
        </button>

        {/* Clear cache button */}
        <button
          className="text-white p-3 bg-red-600 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
          onClick={clearCache}
        >
          <Trans i18nKey="description.cache3" />
        </button>
      </div>
    </BaseModal>
  );
}