import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Trans } from "react-i18next";
import {
  addConversation,
  deleteConversation,
  setCurrentConversation,
  selectConversations,
  selectCurrentConversationId,
  selectIsResponding,
} from "../../Redux/reducers/conversationsSlice";
import { selectDefaultModel } from "../../Redux/reducers/defaultModelSlice";
import { useCallback, useEffect } from "react";

// Asset imports
import cross from "../../assets/cross.svg";
import edit_icon from "../../assets/edit_icon.svg";
import back_arrow from "../../assets/back_arrow.svg";
import { persistor } from "../../Redux/store/store";
import { getDefaultSettings } from "../../utils/settingsUtils";
import { useModal } from "../../modals/ModalContext";

function Sidebar({
  onClose,
  setShowRepoModal,
}) {
  const { openModal } = useModal();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [conversationIds, setConversationIds] = useState([]);
  const conversations = useSelector(selectConversations);
  const currentConversationId = useSelector(selectCurrentConversationId);
  const isResponding = useSelector(selectIsResponding);
  const defaultModel = useSelector(selectDefaultModel);

  // Keep conversation IDs synchronized with the conversations list
  useEffect(() => {
    setConversationIds(conversations.map((conv) => conv.id));
  }, [conversations]);

  // Ensure the current conversation ID is synced with the URL
  useEffect(() => {
    const urlPath = window.location.pathname;
    const pathMatch = urlPath.match(/\/chat\/([^/]+)/);

    if (pathMatch && pathMatch[1] && pathMatch[1] !== currentConversationId) {
      // If URL contains a conversation ID that doesn't match current selection
      const urlConversationId = pathMatch[1];
      if (conversations.some((conv) => conv.id === urlConversationId)) {
        dispatch(setCurrentConversation(urlConversationId));
      }
    }
  }, [currentConversationId, conversations, dispatch]);

  const handleNewChat = useCallback(() => {
    if (isResponding) return; // Prevent new chat while responding
    const defaultSettings = getDefaultSettings();

    // Temporarily disable interaction
    dispatch({ type: "conversations/setIsResponding", payload: true });

    // Add the conversation with the current default model
    const action = dispatch(addConversation());
    const newId = action.meta?.id;

    if (newId) {
      // Update the conversation with the current default model
      dispatch({
        type: "conversations/updateConversation",
        payload: {
          id: newId,
          updates: {
            settings: {
              ["model-name"]: defaultModel.name,
              model: defaultModel.id,
              systemPrompt: "You are a helpful assistant",
              temperature: defaultSettings.temperature,
              top_p: defaultSettings.top_p,
              memory: 2,
            },
          },
        },
      });

      // Force persistence to localStorage BEFORE navigation
      persistor.flush().then(() => {
        // Navigate to the new conversation
        navigate(`/chat/${newId}`);
        // Only close sidebar on mobile (below custom breakpoint 1081px)
        if (window.innerWidth < 1081) {
          onClose?.();
        }

        // Re-enable interaction after navigation
        setTimeout(() => {
          dispatch({ type: "conversations/setIsResponding", payload: false });
        }, 300);
      });
    } else {
      // If no ID was created (unlikely), still re-enable interaction
      dispatch({ type: "conversations/setIsResponding", payload: false });
    }
  }, [dispatch, navigate, onClose, isResponding, defaultModel]);

  const handleSelectConversation = useCallback(
    (id) => {
      if (isResponding || id === currentConversationId) return;

      dispatch(setCurrentConversation(id));
      navigate(`/chat/${id}`);

      // Only close sidebar on mobile (below custom breakpoint 1081px)
      if (window.innerWidth < 1081) {
        onClose?.();
      }
    },
    [dispatch, navigate, onClose, isResponding, currentConversationId]
  );

  return (
    <div
      className="flex flex-col bg-white dark:bg-bg_secondary_dark rounded-2xl shadow-lg dark:shadow-dark select-none h-full"
      style={{
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Mobile Header */}
      <div className="custom:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 h-14 flex-shrink-0">
        <p className="text-base font-medium text-black dark:text-white">
          Conversations
        </p>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors touch-manipulation w-8 h-8 flex items-center justify-center"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <img src={back_arrow} alt="close" className="h-4 w-4" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={handleNewChat}
          disabled={isResponding}
          className={`w-full bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-black dark:text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-medium transition-colors touch-manipulation ${
            isResponding ? "cursor-not-allowed opacity-50" : ""
          }`}
          style={{
            WebkitTapHighlightColor: "transparent",
            minHeight: "44px",
          }}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>
            <Trans i18nKey="description.newConversation" />
          </span>
        </button>
      </div>

      {/* Conversations List - This should take available space */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          className="h-full p-3 overflow-y-auto overscroll-behavior-contain"
          style={{
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="space-y-1">
            {conversations.map((conv) => {
              const id = conv.id
              if (!conv) return null;

              const isCurrentConversation = id === currentConversationId;

              return (
                <div
                  key={id}
                  onClick={() => handleSelectConversation(id)}
                  className={`group px-3 py-2 rounded-xl relative touch-manipulation transition-colors ${
                    isResponding ? "cursor-not-allowed" : "cursor-pointer"
                  } ${
                    isCurrentConversation
                      ? "bg-gray-100 dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-700"
                      : "text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                  data-current={isCurrentConversation ? "true" : "false"}
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    minHeight: "48px",
                  }}
                >
                  <div className="flex items-center justify-between relative">
                    {/* Title with proper truncation */}
                    <div
                      className="flex-1 overflow-hidden pr-2 min-w-0"
                      title={conv.title}
                    >
                      <div className="truncate text-xs font-medium">
                        {conv.title || "Untitled Conversation"}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex-shrink-0 flex items-center gap-1 desktop:opacity-0 desktop:group-hover:opacity-100 opacity-100">
                      <button
                        onClick={(e) => {
                          if (isResponding) return;
                          e.stopPropagation();
                          openModal("renameConversation", {id})
                        }}
                        disabled={isResponding}
                        className={`p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation w-7 h-7 flex items-center justify-center ${
                          isResponding ? "cursor-not-allowed" : ""
                        }`}
                        style={{
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <img
                          src={edit_icon}
                          alt="edit"
                          className="w-3.5 h-3.5"
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          if (isResponding) return;
                          e.stopPropagation();
                          openModal("deleteConversation", {id})
                        }}
                        disabled={isResponding}
                        className={`p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation w-7 h-7 flex items-center justify-center ${
                          isResponding ? "cursor-not-allowed" : ""
                        }`}
                        style={{
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <img src={cross} alt="delete" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Import Persona button - Fixed at bottom */}
      <div className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-bg_secondary_dark rounded-b-2xl">
        <button
          onClick={() => {
            openModal("importPersona");
          }}
          disabled={isResponding}
          className={`w-full bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-black dark:text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-medium transition-colors touch-manipulation ${
            isResponding ? "cursor-not-allowed opacity-50" : ""
          }`}
          style={{
            WebkitTapHighlightColor: "transparent",
            minHeight: "44px",
          }}
        >
          <span>
            <Trans i18nKey="description.importPersona" />
          </span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
