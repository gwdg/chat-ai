import { useRef, useState } from "react";
import { Trans } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  selectCurrentConversationId,
  selectLockConversation,
} from "../../Redux/reducers/conversationsSlice";

import { ChevronLeft, Edit, X } from "lucide-react";
import { useConversationList } from "../../db";
import { useModal } from "../../modals/ModalContext";
import { getDefaultSettings } from "../../utils/conversationUtils";

function Sidebar({ localState, setLocalState, onClose, handleNewChat }) {
  const { openModal } = useModal();
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState(null);

  const conversations = useConversationList();
  const currentConversationId = useSelector(selectCurrentConversationId);
  const lockConversation = useSelector(selectLockConversation);
  const defaultSettings = useRef(getDefaultSettings);

  const handleSelectConversation = (id) => {
    if (lockConversation || id === currentConversationId) return;
    navigate(`/chat/${id}`);
    if (window.innerWidth < 1081) {
      onClose?.();
    }
  };

  return (
    <div
      className="flex flex-col bg-white dark:bg-bg_secondary_dark desktop:rounded-lg dark:shadow-dark shadow-lg border border-gray-200 dark:border-gray-800 select-none h-full w-full max-w-[280px] lg:max-w-[245px] transition-all duration-300 ease-in-out"
      style={{
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Desktop Header with close button */}
      <div className="hidden desktop:flex items-center justify-end px-3 py-2">
        <button
          onClick={onClose}
          className="cursor-pointer p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Close sidebar"
        >
          <ChevronLeft className="w-5 h-5 text-tertiary" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="flex-shrink-0 m-3 border-b border-gray-100 dark:border-gray-800 pb-3">
        <button
          onClick={handleNewChat}
          disabled={lockConversation}
          className={`cursor-pointer w-full bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-black dark:text-white px-4 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-medium touch-manipulation transition-colors ${
            lockConversation ? "cursor-not-allowed opacity-50" : ""
          }`}
          style={{
            WebkitTapHighlightColor: "transparent",
            minHeight: "44px",
          }}
        >
          <svg
            className="h-4 w-4 flex-shrink-0"
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
          <span className="truncate">
            <Trans i18nKey="description.newConversation" />
          </span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 mx-3 min-h-0 overflow-hidden">
        <div
          className="h-full overflow-y-auto overflow-x-hidden overscroll-behavior-contain"
          style={{
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="space-y-1 pb-3">
            {conversations.map((conv) => {
              const id = conv.id;
              if (!conv) return null;
              const isActive = id === currentConversationId;
              const isHovered = hoveredId === id;

              return (
                <div
                  key={id}
                  onClick={() => handleSelectConversation(id)}
                  onMouseEnter={() => setHoveredId(id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`group relative px-3 py-3 rounded-2xl cursor-pointer touch-manipulation transition-all duration-200 ${
                    lockConversation ? "cursor-not-allowed opacity-60" : ""
                  } ${
                    isActive
                      ? "bg-gray-100 dark:bg-gray-800 text-black dark:text-white shadow-sm"
                      : "text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                  data-current={isActive ? "true" : "false"}
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    minHeight: "52px",
                  }}
                >
                  {/* Title container */}
                  <div className="flex items-center h-full w-full">
                    <div
                      className="flex-1 overflow-hidden min-w-0 mr-12"
                      title={conv.title || "Untitled Conversation"}
                    >
                      <div className="truncate text-xs font-medium leading-relaxed">
                        {conv.title || "Untitled Conversation"}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div
                      className={`absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 transition-opacity duration-200 ${
                        window.innerWidth < 1024 || isHovered
                          ? "opacity-100"
                          : "opacity-0"
                      } group-hover:opacity-100`}
                    >
                      <button
                        onClick={(e) => {
                          if (lockConversation) return;
                          e.stopPropagation();
                          openModal("renameConversation", {
                            id,
                            currentTitle: conv.title || "Untitled Conversation",
                            localState,
                            setLocalState,
                          });
                        }}
                        disabled={lockConversation}
                        className={`p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 touch-manipulation flex items-center justify-center ${
                          lockConversation
                            ? "cursor-not-allowed opacity-50"
                            : "hover:scale-110 active:scale-95 cursor-pointer"
                        }`}
                        style={{
                          WebkitTapHighlightColor: "transparent",
                        }}
                        title="Edit conversation"
                      >
                        <Edit className="w-3 h-3 text-[#009EE0]" alt="edit" />
                      </button>
                      <button
                        onClick={(e) => {
                          if (lockConversation) return;
                          e.stopPropagation();
                          openModal("deleteConversation", {
                            id,
                            conversations,
                          });
                        }}
                        disabled={lockConversation}
                        className={`p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all duration-200 touch-manipulation flex items-center justify-center ${
                          lockConversation
                            ? "cursor-not-allowed opacity-50"
                            : "hover:scale-110 active:scale-95 cursor-pointer"
                        }`}
                        style={{
                          WebkitTapHighlightColor: "transparent",
                        }}
                        title="Delete conversation"
                      >
                        <X className="h-3.5 w-3.5 text-[#009EE0]" alt="cross" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Import Persona button */}
      <div className="flex-shrink-0 m-3 border-t border-gray-200 dark:border-gray-800 pt-3">
        <button
          onClick={() => {
            openModal("importPersona");
          }}
          disabled={lockConversation}
          className={`cursor-pointer w-full bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-black dark:text-white px-4 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-medium touch-manipulation transition-colors ${
            lockConversation ? "cursor-not-allowed opacity-50" : ""
          }`}
          style={{
            WebkitTapHighlightColor: "transparent",
            minHeight: "44px",
          }}
        >
          <span className="truncate">
            <Trans i18nKey="description.importPersona" />
          </span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
