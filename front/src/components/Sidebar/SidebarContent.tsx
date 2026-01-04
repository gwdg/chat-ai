import { useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";

import {
  ChevronLeft,
  Download,
  Edit,
  FolderInput,
  FolderPlus,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { useConversationList, useFolderList } from "../../db";
import { useModal } from "../../modals/ModalContext";

import { toggleSidebar } from "../../Redux/reducers/interfaceSettingsSlice";

import { Bot } from "lucide-react";
import { useWindowSize } from "../../hooks/useWindowSize";
import ImportConversationButton from "./ImportConversationButton";
import AiServicesMenu from "./AiServicesMenu";

const ALL_FOLDERS = "__all__";

export default function SidebarContent({
  localState,
  setLocalState,
  handleNewConversation,
}: {
  localState: any;
  setLocalState: (state: any) => void;
  handleNewConversation: (folderId?: string | null) => Promise<void>;
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const { t } = useTranslation();
  const currentConversationId = localState?.id;

  const { isDesktop, isTouch } = useWindowSize();
  const conversations = useConversationList() || [];
  const folders = useFolderList() || [];
  const folderMap = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders]
  );
  const [activeFolderId, setActiveFolderId] = useState<string>(ALL_FOLDERS);
  // have an own state of selected Conversation id to update the ui smoothly
  const [selectedConversationId, setSelectedConversationId] = useState(
    currentConversationId
  );
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    if (localState?.id) {
      setSelectedConversationId(currentConversationId);
    }
  }, [localState, currentConversationId]);

  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;

  useEffect(() => {
    if (activeFolderId === ALL_FOLDERS) {
      return;
    }
    const exists = folders.some((folder) => folder.id === activeFolderId);
    if (!exists) {
      setActiveFolderId(ALL_FOLDERS);
    }
  }, [activeFolderId, folders]);

  const [activeMenu, setActiveMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);
  const menuButtonRefs = useRef({}); // Add refs for menu buttons

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set(ALL_FOLDERS, conversations.length);
    folders.forEach((folder) => counts.set(folder.id, 0));
    conversations.forEach((conv) => {
      if (!conv.folderId) return;
      const key = conv.folderId;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [conversations, folders]);

  const filteredByFolder = useMemo(() => {
    if (activeFolderId === ALL_FOLDERS) return conversations;
    return conversations.filter((conv) => conv.folderId === activeFolderId);
  }, [conversations, activeFolderId]);

  const visibleConversations = useMemo(() => {
    if (!hasSearch) return filteredByFolder;
    return filteredByFolder.filter((conv) => {
      const title = conv.title || t("conversation.untitled", { defaultValue: "Untitled Conversation" });
      return title.toLowerCase().includes(normalizedSearch);
    });
  }, [filteredByFolder, hasSearch, normalizedSearch, t]);

  const noSearchResults = hasSearch && visibleConversations.length === 0;

  function onClose() {
    dispatch(toggleSidebar());
  }

  const handleFolderSelection = (folderId: string) => {
    setActiveFolderId(folderId);
  };

  const handleCreateFolder = () => {
    openModal("createFolder");
  };

  const handleRenameFolder = (folder: { id: string; name: string }) => {
    openModal("renameFolder", {
      folderId: folder.id,
      initialName: folder.name,
    });
  };

  const handleDeleteFolder = (folder: { id: string; name: string }) => {
    openModal("deleteFolder", {
      folderId: folder.id,
      folderName: folder.name,
    });
  };

  const handleMoveConversation = (conv) => {
    if (!conv) return;
    openModal("moveConversation", {
      conversationId: conv.id,
      conversationTitle: conv.title || "Untitled Conversation",
      currentFolderId: conv.folderId ?? null,
      folders,
      localState,
      setLocalState,
    });
  };

  const getFolderDisplayName = (folderId?: string | null) => {
    if (!folderId) return t("folders.uncategorized");
    return folderMap.get(folderId) || t("folders.uncategorized");
  };

  const highlightText = (text?: string | null) => {
    const value = text || t("conversation.untitled", { defaultValue: "Untitled Conversation" });
    if (!hasSearch) return value;
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapeRegExp(normalizedSearch)})`, "ig");
    const parts = value.split(regex);
    return parts.map((part, index) => {
      if (part.toLowerCase() === normalizedSearch) {
        return (
          <mark
            key={`highlight-${index}`}
            className="bg-yellow-200 dark:bg-yellow-600/60 text-black dark:text-white px-0.5 rounded-sm"
          >
            {part}
          </mark>
        );
      }
      return <span key={`text-${index}`}>{part}</span>;
    });
  };

  const renderFolderRow = (option: {
    id: string
    label: string
    countKey: string
    canEdit?: boolean
    folder?: { id: string; name: string }
  }) => {
    const isActive = activeFolderId === option.id;
    const rawCount = folderCounts.get(option.countKey) ?? 0;
    const displayCount = rawCount > 99 ? "99+" : rawCount;
    return (
      <div
        key={option.id}
        role="button"
        tabIndex={0}
        onClick={() => handleFolderSelection(option.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleFolderSelection(option.id);
          }
        }}
        className={`group flex items-center gap-2 rounded-2xl px-3 py-2 text-xs transition cursor-pointer ${
          isActive
            ? "bg-gray-100 dark:bg-gray-800 text-black dark:text-white shadow-sm"
            : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40"
        }`}
      >
        <div className="flex-1 flex items-center justify-between text-left select-none pointer-events-none">
          <span className="truncate">{option.label}</span>
          <span className="ml-2 text-[11px] font-semibold text-gray-500 dark:text-gray-200">
            {displayCount}
          </span>
        </div>
        {option.canEdit && option.folder && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRenameFolder(option.folder);
              }}
              className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFolder(option.folder);
              }}
              className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const handleSelectConversation = (id) => {
    if (id === currentConversationId) return;
    setSelectedConversationId(id); // update selected now for nicer user interaction
    navigate(`/chat/${id}`);
    if (!isDesktop) {
      onClose();
    }
  };

  const onNewConversation = () => {
    const targetFolder =
      activeFolderId === ALL_FOLDERS
        ? null
        : activeFolderId;
    handleNewConversation(targetFolder)
      .then(() => {
        if (conversations[0]?.id) {
          setSelectedConversationId(currentConversationId);
        }
      })
      .catch((error) => {
        console.error("Failed to start new conversation", error);
      });
  };

  const handleTitleDoubleClick = (e, conv) => {
    e.stopPropagation(); // Prevent conversation selection
    e.preventDefault();

    // Only enable double-click rename on desktop
    if (!isDesktop) return;

    openModal("renameConversation", {
      id: conv.id,
      currentTitle: conv.title || "Untitled Conversation",
      localState: localState,
      setLocalState: setLocalState,
    });
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
      className="flex flex-col select-none h-full w-full transition-all duration-200 ease-in-out"
      style={{
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between">
        <AiServicesMenu />
        <button
          onClick={onClose}
          className="m-3 cursor-pointer p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Close sidebar"
        >
          <ChevronLeft className="w-7 h-7 text-tertiary" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="flex-shrink-0 m-3 border-b border-gray-100 dark:border-gray-800 pb-3">
        <button
          onClick={onNewConversation}
          className={`cursor-pointer w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-black dark:text-white px-4 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-medium touch-manipulation transition-colors`}
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
            <Trans i18nKey="sidebar.new_conversation" />
          </span>
        </button>
      </div>

      {/* Folder Filters */}
      <div className="flex flex-col gap-3 mx-3 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Trans i18nKey="folders.search_label" />
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("folders.search_placeholder")}
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-xs text-black dark:text-white pr-7 focus:outline-none focus:ring-2 focus:ring-tertiary/40"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                aria-label={t("folders.clear_search")}
                onClick={() => setSearchQuery("")}
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <span>{t("folders.title")}</span>
          <button
            type="button"
            onClick={handleCreateFolder}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition"
            aria-label={t("folders.create_button")}
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {renderFolderRow({
            id: ALL_FOLDERS,
            label: t("folders.all"),
            countKey: ALL_FOLDERS,
          })}
          {folders.map((folder) =>
            renderFolderRow({
              id: folder.id,
              label: folder.name,
              countKey: folder.id,
              canEdit: true,
              folder,
            })
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div
        className="flex-1 mx-3 overflow-hidden h-full overflow-y-auto overscroll-behavior-contain space-y-1 pb-3"
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >
        {noSearchResults && (
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-4">
            <Trans i18nKey="folders.search_no_results" values={{ query: searchQuery }} />
          </div>
        )}
        {visibleConversations.map((conv) => {
          const id = conv.id;
          if (!conv) return null;
          const isActive = id === selectedConversationId;
          const isHovered = hoveredId === id;
          const isMenuOpen = activeMenu === id;

          return (
            <div
              key={id}
              onClick={() => handleSelectConversation(id)}
              className={`group relative px-3 py-3 rounded-2xl touch-manipulation ${
                isActive
                  ? "bg-gray-100 dark:bg-gray-800 text-black dark:text-white shadow-sm"
                  : "text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-100"
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
                  onDoubleClick={(e) => handleTitleDoubleClick(e, conv)}
                  style={{ cursor: isDesktop ? "text" : "pointer" }}
                >
                  <div className="truncate text-xs font-medium leading-relaxed cursor-pointer">
                    {highlightText(conv.title)}
                  </div>
                  {/* Removed folder label under "All chats" */}
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
                  className={`transition-opacity duration-200 ${
                    window.innerWidth < 1024 ||
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
                    className={`p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 touch-manipulation flex items-center justify-center 
                      hover:scale-110 active:scale-95 cursor-pointer`}
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
        <ImportConversationButton variant="button" />
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
            <Trans i18nKey="sidebar.import_persona" />
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
              <Trans i18nKey="common.rename" />
              {/* TODO use Translation */}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                const conv = conversations.find((c) => c.id === activeMenu);
                if (conv) {
                  handleMoveConversation(conv);
                  closeMenu();
                }
              }}
              className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <FolderInput className="w-3.5 h-3.5" />
              <Trans i18nKey="folders.move_action" />
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
                openModal("exportConversation", {
                  localState,
                  conversationId: conv.id,
                });
                closeMenu();
              }}
              className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Download className="w-3.5 h-3.5" />
              <Trans i18nKey="export_conversation.export" />
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
              <Trans i18nKey="common.delete" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
