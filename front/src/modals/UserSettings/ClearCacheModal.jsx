import { Trans } from "react-i18next";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../hooks/useToast";
import { useCallback, useState } from "react";
// Hooks
import {
  getDefaultConversation,
} from "../../utils/conversationUtils";
import { createConversation, resetDB } from "../../db";

import BaseModal from "../BaseModal";

export default function ClearCacheModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useToast();
  const [isCleared, setIsCleared] = useState(false);

  const clearData = useCallback(async () => {
    try {
      // Prepare to navigate
      setIsCleared(true);
      await resetDB(); // Reset IndexedDB
      await dispatch({ // Reset Redux
        type: "RESET_ALL",
        meta: {
          sync: true,
        },
      });
      const newConversationId = await createConversation(
        getDefaultConversation()
      );
      console.log("New conversation", newConversationId);
      navigate(`/chat/${newConversationId}`, { replace: true });
      onClose();
    } catch (error) {
      notifyError("Failed to clear chats: " + error.message);
    }
  }, [dispatch, notifySuccess, notifyError]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="alert.title"
    >
      {/* Message */}
      <div className="pt-0 pb-2">
        <p className="text-base-content text-justify text-sm">
          <Trans i18nKey="alert.clear_data" />
        </p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm mt-2">
        {/* Cancel button */}
        <button
          className="btn btn-accent md:w-fit w-full min-w-[150px] select-none"
          onClick={onClose}
        >
          <Trans i18nKey="alert.no" />
        </button>

        {/* Clear data button */}
        <button
          className="btn btn-error md:w-fit w-full min-w-[150px] select-none"
          onClick={clearData}
        >
          <Trans i18nKey="alert.yes" />
        </button>
      </div>
    </BaseModal>
  );
}
