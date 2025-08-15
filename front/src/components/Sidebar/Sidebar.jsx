import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Trans } from "react-i18next";
import {
  selectConversations,
  selectCurrentConversationId,
  selectLockConversation,
} from "../../Redux/reducers/conversationsSlice";
import { useCallback, useEffect } from "react";

// Asset imports
import icon_cross_sm from "../../assets/icons/cross_sm.svg";
import icon_edit from "../../assets/icons/edit.svg";
import icon_arrow_left from "../../assets/icons/arrow_left.svg";
import { persistor } from "../../Redux/store/store";
import { getDefaultConversation, getDefaultSettings } from "../../utils/conversationUtils";
import { useModal } from "../../modals/ModalContext";
import { createConversation, useConversationList } from "../../db";

function Sidebar({
    localState,
    setLocalState,
    onClose
  }) {
  const { openModal } = useModal();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const conversations = useConversationList();
  const currentConversationId = useSelector(selectCurrentConversationId);
  const lockConversation = useSelector(selectLockConversation);
  const defaultSettings = useRef(getDefaultSettings);

  const handleSelectConversation = (id) => {
      if (lockConversation || id === currentConversationId) return;
      navigate(`/chat/${id}`);
      // Only close sidebar on mobile (below custom breakpoint 1081px)
      if (window.innerWidth < 1081) {
        onClose?.();
      }
    }

  const handleNewChat = useCallback(async () => {
    // Temporarily disable interaction
    dispatch({ type: "conversations/setLockConversation", payload: true });
    // Add default conversation
    const newId = await createConversation(getDefaultConversation());
    if (newId) {
      // Force persistence to localStorage BEFORE navigation
      persistor.flush().then(() => {
        // Select new conversation
        handleSelectConversation(newId);
        // // Re-enable interaction after navigation
        // setTimeout(() => {
        //   dispatch({ type: "conversations/setLockConversation", payload: false });
        // }, 300);
      });
    } else {
      // If no ID was created (unlikely), still re-enable interaction
      // dispatch({ type: "conversations/setLockConversation", payload: false });
    }
  }, [dispatch, navigate, onClose, lockConversation, defaultSettings]);

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
        {/* <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors touch-manipulation w-8 h-8 flex items-center justify-center"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <img src={icon_arrow_left} alt="close" className="h-4 w-4" />
        </button> */}
      </div>

      {/* New Chat Button */}
      <div className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={handleNewChat}
          disabled={lockConversation}
          className={`w-full bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-black dark:text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-medium transition-colors touch-manipulation ${
            lockConversation ? "cursor-not-allowed opacity-50" : ""
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
              const id = conv.id;
              if (!conv) return null;
              return (
                <div
                  key={id}
                  onClick={() => handleSelectConversation(id)}
                  className={`group px-3 py-2 rounded-xl relative touch-manipulation transition-colors ${
                    lockConversation ? "cursor-not-allowed" : "cursor-pointer"
                  } ${
                    id === currentConversationId
                      ? "bg-gray-100 dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-700"
                      : "text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                  data-current={id === currentConversationId ? "true" : "false"}
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
                          if (lockConversation) return;
                          e.stopPropagation();
                          openModal("renameConversation", {id, localState, setLocalState})
                        }}
                        disabled={lockConversation}
                        className={`p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation w-7 h-7 flex items-center justify-center ${
                          lockConversation ? "cursor-not-allowed" : ""
                        }`}
                        style={{
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <img
                          src={icon_edit}
                          alt="edit"
                          className="w-3.5 h-3.5"
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          if (lockConversation) return;
                          e.stopPropagation();
                          openModal("deleteConversation", {id, conversations})
                        }}
                        disabled={lockConversation}
                        className={`p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation w-7 h-7 flex items-center justify-center ${
                          lockConversation ? "cursor-not-allowed" : ""
                        }`}
                        style={{
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <img src={icon_cross_sm} alt="delete" className="w-3.5 h-3.5" />
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
          disabled={lockConversation}
          className={`w-full bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-black dark:text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-medium transition-colors touch-manipulation ${
            lockConversation ? "cursor-not-allowed opacity-50" : ""
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
