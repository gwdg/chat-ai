import { Trans } from "react-i18next";
import store, { persistor } from "../../Redux/store/store";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../hooks/useToast";
import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
// Hooks
import { getDefaultSettings } from "../../utils/settingsUtils";

import BaseModal from "../BaseModal";

export default function ClearCacheModal({ isOpen, onClose }) {
  
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useToast();

  // Helper function to create conversation payload
  const createConversationPayload = (
    conversationId,
    currentDefaultModel = null
  ) => {
    const defaultSettings = getDefaultSettings();
    const settings = {
      ...defaultSettings,
      // Override with current default model if available
      ...(currentDefaultModel && {
        //["model-name"]: currentDefaultModel.name,
        model: currentDefaultModel,//.id,
      }),
    };

    return {
      id: conversationId,
      title: "Untitled Conversation",
      messages: [
        {
          role: "system",
          content: settings.systemPrompt,
        },
      ],
      responses: [],
      prompt: "",
      settings,
      exportOptions: {
        exportSettings: false,
        exportImage: false,
        exportArcana: false,
      },
      dontShow: {
        dontShowAgain: false,
        dontShowAgainShare: false,
        dontShowAgainMemory: false,
      },
      arcana: {
        id: "",
        // key: "",
      },
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
  };

  const clearCache = useCallback(async () => {
    try {
      console.log("I'm trying to clear")
      // Generate a new ID that will be used across all tabs
      const newConversationId = uuidv4();

      // Save the current state BEFORE purging (this is crucial)
      const currentState = store.getState();
      const currentTheme = currentState.theme;
      const currentAdvOption = currentState.advOption;
      const currentDefaultModel = currentState.defaultModel; // Get BEFORE purge

      await persistor.purge();

      // Dispatch RESET_ALL with all preserved states
      dispatch({
        type: "RESET_ALL",
        payload: {
          newConversationId,
          theme: currentTheme,
          advOption: currentAdvOption,
          defaultModel: currentDefaultModel, // Pass the saved default model
        },
        meta: {
          sync: true,
        },
      });

      // Create the new conversation with proper settings
      const conversationPayload = createConversationPayload(
        newConversationId,
        currentDefaultModel
      );

      dispatch({
        type: "conversations/resetStore",
        payload: conversationPayload,
        meta: { id: newConversationId, sync: true },
      });

      notifySuccess("Chats cleared successfully");

      // Navigate to new conversation after cache clear
      if (newConversationId) {
        window.history.replaceState(null, "", `/chat/${newConversationId}`);
        navigate(`/chat/${newConversationId}`, { replace: true });
      }

      setShowCacheModal(false);
      // setShowUserSettingsModal(false);
    } catch (error) {
      notifyError("Failed to clear chats: " + error.message);
    }
  }, [dispatch, navigate, notifySuccess, notifyError]);

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