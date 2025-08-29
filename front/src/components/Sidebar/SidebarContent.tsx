import { useRef, useState, useCallback, useEffect } from "react";
import { Trans } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import {
  selectCurrentConversationId,
  selectLockConversation,
} from "../../Redux/reducers/conversationsSlice";

import { ChevronLeft, Download, Edit, MoreVertical, Trash2, X } from "lucide-react";
import { useConversationList } from "../../db";
import { useModal } from "../../modals/ModalContext";
import LogoContainer from "../Header/LogoContainer";
import { persistor } from "../../Redux/store/store";

import { createConversation } from "../../db";
import Logo from "../../assets/logos/chat_ai.svg";

import {
  selectDarkMode,
  selectShowSettings,
  selectShowSidebar,
  toggleSidebar,
} from "../../Redux/reducers/interfaceSettingsSlice";

import {
  getDefaultConversation,
  getDefaultSettings,
} from "../../utils/conversationUtils";

import { Bot, Sidebar } from "lucide-react";
import { useWindowSize } from "../../hooks/useWindowSize";
import ImportConversationButton from "./ImportConversationButton";

export default function SidebarContent({ localState, setLocalState, handleNewConversation }: { localState: any, setLocalState: (state: any) => void, handleNewConversation: () => void }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const lockConversation = useSelector(selectLockConversation);
  const currentConversationId = localState?.id;

  // have an own state of selected Conversation id to update the ui smoothly
  const [selectedConversationId, setSelectedConversationId] = useState(currentConversationId);
  useEffect(() => {
    if (localState?.id) {
      setSelectedConversationId(currentConversationId);
    }
  }, [localState]);

  const [hoveredId, setHoveredId] = useState(null);
  const { isMobile, isTablet, isDesktop, isTouch } = useWindowSize();
  const conversations = useConversationList();

  const [activeMenu, setActiveMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);
  const menuButtonRefs = useRef({}); // Add refs for menu buttons


  function onClose() {
    dispatch(toggleSidebar());
  }

  const handleSelectConversation = (id) => {
    if (lockConversation || id === currentConversationId) return;
    setSelectedConversationId(id); // update selected now for nicer user interaction
    navigate(`/chat/${id}`);
    if (!isDesktop) {
      onClose();
    }
  };

  const onNewConversation = () => {
    handleNewConversation();
    //update index to newest in list for smoother ui. Don't wait for dexie to sync
    if (conversations[0]?.id) {
      setSelectedConversationId(currentConversationId);
    }
  };

  const handleExportConversation = (conv) => {
    const dataStr = JSON.stringify(conv, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = `conversation-${conv.id}-${Date.now()}.json`;
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const openMenu = (e, convId) => {
    e.stopPropagation();
    e.preventDefault();

    // Get button position first (while e.currentTarget is still valid)
    const rect = e.currentTarget.getBoundingClientRect();
    const newPosition = {
      x: rect.right + 5,
      y: rect.top - 5,
    };

    // Use functional setState to ensure we're working with the latest state
    setActiveMenu((prevActiveMenu) => {
      if (prevActiveMenu === convId) {
        // Menu is already open for this conversation, close it
        return null;
      } else {
        // Open menu for this conversation
        // Set the position that we calculated earlier
        setMenuPosition(newPosition);
        return convId;
      }
    });
  };

  const closeMenu = () => {
    setActiveMenu(null);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is on menu or any menu button
      const clickedOnMenuButton = Object.values(menuButtonRefs.current).some(
        (ref) => ref && ref.contains(event.target)
      );

      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        !clickedOnMenuButton
      ) {
        closeMenu();
      }
    };

    if (activeMenu) {
      // Use a slight delay to avoid immediate firing
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [activeMenu]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        closeMenu();
      }
    };

    if (activeMenu) {
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [activeMenu]);

  return (
    <div
      className="flex flex-col select-none h-full w-full transition-all duration-300 ease-in-out"
      style={{
        WebkitTapHighlightColor: "transparent",
      }}
    >

      {/* Desktop Header with close button */}
      <div className="hidden md:flex items-center justify-between p-3 ">
        <span className="px-3 flex items-center">
          <img
            className="h-10 w-auto object-contain"
            src={Logo}
            alt="Chat AI Logo"
          />
        </span>

        <button
          onClick={onClose}
          className="cursor-pointer p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Close sidebar"
        >
          <ChevronLeft className="w-7 h-7 text-tertiary" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="flex-shrink-0 m-3 border-b border-gray-100 dark:border-gray-800 pb-3">
        <button
          onClick={onNewConversation}
          disabled={lockConversation}
          className={`cursor-pointer w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-black dark:text-white px-4 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-medium touch-manipulation transition-colors ${lockConversation ? "cursor-not-allowed opacity-50" : ""
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
      <div
        className="flex-1 mx-3 overflow-hidden h-full overflow-y-auto overscroll-behavior-contain space-y-1 pb-3"
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >
        {conversations.map((conv) => {
          const id = conv.id;
          if (!conv) return null;
          const isActive = id === selectedConversationId;
          const isHovered = hoveredId === id;
          const isMenuOpen = activeMenu === id;

          return (
            <div
              key={id}
              onClick={() => handleSelectConversation(id)}
              className={`group relative px-3 py-3 rounded-2xl cursor-pointer touch-manipulation transition-all duration-200 ${lockConversation ? "cursor-not-allowed opacity-60" : ""
                } ${isActive
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
              <div className="flex items-center h-full w-full group">
                <div
                  className="flex-1 overflow-hidden min-w-0"
                  title={conv.title || "Untitled Conversation"}
                >
                  <div className="truncate text-xs font-medium leading-relaxed">
                    {conv.title || "Untitled Conversation"}
                  </div>
                </div>

                {/* Action buttons 
                <div
                  className={`
                    flex items-center gap-1 
                    
                    transition-opacity duration-200 
                    ${window.innerWidth < 1024 || isHovered || isTouch ? "opacity-100" : "opacity-0"
                    } group-hover:opacity-100`}
                >
                  <button
                    onClick={(e) => {
                      if (lockConversation) return;
                      e.stopPropagation();
                      openModal("renameConversation", {
                        id,
                        currentTitle: conv.title || "Untitled Conversation",
                      });
                    }}
                    disabled={lockConversation}
                    className={`p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 touch-manipulation flex items-center justify-center ${lockConversation
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
                        currentConversationId: localState?.id,
                      });
                    }}
                    disabled={lockConversation}
                    className={`p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all duration-200 touch-manipulation flex items-center justify-center ${lockConversation
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
                </div>*/}
                {/* Dropdown Menu Button */}
                <div
                  className={`transition-opacity duration-200 ${window.innerWidth < 1024 ||
                    isHovered ||
                    isActive ||
                    isMenuOpen
                    ? "opacity-100"
                    : "opacity-0"
                    } group-hover:opacity-100`}
                >
                  <button
                    ref={(el) => (menuButtonRefs.current[id] = el)}
                    onClick={(e) => openMenu(e, id)}
                    className={`p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 touch-manipulation flex items-center justify-center ${lockConversation
                      ? "cursor-not-allowed opacity-50"
                      : "hover:scale-110 active:scale-95 cursor-pointer"
                      }`}
                    style={{
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <MoreVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
    </div>

      {/* Bottom section */}
      <div className="flex flex-col gap-4 m-3 border-t border-gray-200 dark:border-gray-500 pt-3">
        {/* Import Conversation button */}
        <ImportConversationButton
          variant="button"
        />
        {/* Import Persona button */}
        <button
          onClick={() => {
            openModal("importPersona");
          }}
          className={`cursor-pointer w-full bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-black dark:text-white px-4 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-medium touch-manipulation transition-colors`}
          style={{
            WebkitTapHighlightColor: "transparent",
            minHeight: "44px",
          }}
        >
          <Bot className="h-5 w-5 flex-shrink-0" />
          <span className="truncate">
            <Trans i18nKey="description.importPersona" />
          </span>
        </button>
      </div>

      {/* MENU RENDERED OUTSIDE - PORTAL STYLE */}
      {activeMenu && (
        <div
          ref={menuRef}
          className="fixed w-40 rounded-lg shadow-2xl ring-1 ring-black/10 dark:ring-white/10 border border-gray-200 dark:border-gray-700"
          style={{
            left: `${menuPosition.x}px`,
            top: `${menuPosition.y}px`,
            zIndex: 999999,
            backgroundColor: "rgb(255, 255, 255)",
          }}
        >
          {/* Solid background overlay to hide text */}
          <div
            className="absolute inset-0 bg-white dark:bg-gray-800 rounded-lg"
            style={{ zIndex: -1 }}
          />

          <div className="p-1 bg-white dark:bg-gray-800 rounded-lg relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const conv = conversations.find((c) => c.id === activeMenu);
                openModal("renameConversation", {
                  id: activeMenu,
                  currentTitle: conv?.title || "Untitled Conversation",
                  localState: localState,
                  setLocalState: setLocalState,
                });
                closeMenu();
              }}
              className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Edit className="w-3.5 h-3.5" />
              Rename
              {/* TODO use Translation */}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                const conv = conversations.find((c) => c.id === activeMenu);
                if (conv.id === localState.id) {
                  // Flush changes
                  setLocalState((prev) => ({
                    ...prev,
                    flush: true,
                  }));
                }
                console.log(conv);
                openModal("exportConversation", { localState, conversationId: conv.id });
                closeMenu();
              }}
              className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Download className="w-3.5 h-3.5" />
              <Trans i18nKey="description.export" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                openModal("deleteConversation", {
                  id: activeMenu,
                  conversations,
                  currentConversationId: localState?.id,
                });
                closeMenu();
              }}
              className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <Trans i18nKey="description.delete_confirmText" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}