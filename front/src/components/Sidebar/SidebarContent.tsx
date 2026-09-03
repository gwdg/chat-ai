import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";

import {
  ChevronLeft,
  FolderMoveTo,
  OverflowMenuVertical,
  Search,
  Close,
} from "@carbon/icons-react";
import {
  assignConversationToFolder,
  useConversationList,
  useFolderList,
} from "../../db";
import { useModal } from "../../modals/ModalContext";

import {
  selectCollapsedTopics,
  selectDarkMode,
  selectShowUsageInSidebar,
  toggleSidebar,
} from "../../Redux/reducers/interfaceSettingsSlice";

import { useWindowSize } from "../../hooks/useWindowSize";
import TopicList, { UNSORTED_TOPIC_ID } from "./TopicList";
import TopicCreateBubble from "./TopicCreateBubble";
import SidebarUserCard from "./SidebarUserCard";
import AiServicesMenu from "./AiServicesMenu";
import { useToast } from "../../hooks/useToast";
import UserLimitsDisplay from "../../modals/UserSettings/UserLimitsDisplay";
import OrgLimitsDisplay from "../../modals/UserSettings/OrgLimitsDisplay";
import ShortcutTooltip from "./ShortcutTooltip";
import ImportChatButton from "./Buttons/ImportChatButton";
import ImportPersonaButton from "./Buttons/ImportPersonaButton";
import NewChatButton from "./Buttons/NewChatButton";
import SummarizeChatButton from "./Buttons/SummarizeChatButton";
import ExportChatButton from "./Buttons/ExportChatButton";
import DeleteChatButton from "./Buttons/DeleteChatButton";
import RenameChatButton from "./Buttons/RenameChatButton";

export default function SidebarContent({
  localState,
  setLocalState,
  handleNewConversation,
  userData,
  modelsData,
}: {
  localState: any;
  setLocalState: (state: any) => void;
  handleNewConversation: (folderId?: string | null) => Promise<void>;
  userData?: any;
  modelsData?: any;
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const currentConversationId = localState?.id;
  const showUsageInSidebar = useSelector(selectShowUsageInSidebar);
  const isDark = useSelector(selectDarkMode);

  const { isDesktop, windowWidth } = useWindowSize();
  // Below this the sidebar is an overlay drawer (see Sidebar.jsx), which leaves
  // an anchored bubble nowhere to go — those widths keep the dialog.
  const sidebarIsDocked = windowWidth >= 1081;
  const conversations = useConversationList() || [];
  const folders = useFolderList() || [];
  
  // have an own state of selected Conversation id to update the ui smoothly
  const [selectedConversationId, setSelectedConversationId] = useState(currentConversationId);
  const [hoveredId, setHoveredId] = useState(null);
  const [draggingConversationId, setDraggingConversationId] = useState<
    string | null
  >(null);
  const [dragOverTopicId, setDragOverTopicId] = useState<string | null>(null);

  useEffect(() => {
    if (localState?.id) {
      setSelectedConversationId(currentConversationId);
    }
  }, [localState, currentConversationId]);

  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchVisible = searchOpen || hasSearch;

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  const closeSearch = useCallback(() => {
    setSearchQuery("");
    setSearchOpen(false);
  }, []);

  const [activeMenu, setActiveMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);
  const menuButtonRefs = useRef({}); // Add refs for menu buttons

  const visibleConversations = useMemo(() => {
    if (!hasSearch) return conversations;
    return conversations.filter((conv) => {
      const title =
        conv.title ||
        t("conversation.untitled", { defaultValue: "Untitled Chat" });
      return title.toLowerCase().includes(normalizedSearch);
    });
  }, [conversations, hasSearch, normalizedSearch, t]);

  const conversationsByTopic = useMemo(() => {
    const grouped = new Map<string, any[]>();
    folders.forEach((folder) => grouped.set(folder.id, []));
    conversations.forEach((conv) => {
      const bucket = conv.folderId ? grouped.get(conv.folderId) : undefined;
      if (bucket) bucket.push(conv);
    });
    return grouped;
  }, [conversations, folders]);

  // Conversations with no topic — plus any whose topic has since disappeared,
  // so a stale folderId can never hide a conversation from the sidebar.
  const unsortedConversations = useMemo(() => {
    const known = new Set(folders.map((folder) => folder.id));
    return conversations.filter(
      (conv) => !conv.folderId || !known.has(conv.folderId),
    );
  }, [conversations, folders]);

  const noSearchResults = hasSearch && visibleConversations.length === 0;

  const handleConversationDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, conversationId: string) => {
      event.dataTransfer?.setData("text/plain", conversationId);
      event.dataTransfer.effectAllowed = "move";
      setDraggingConversationId(conversationId);
      setDragOverTopicId(null);
    },
    [],
  );

  const handleConversationDragEnd = useCallback(() => {
    setDraggingConversationId(null);
    setDragOverTopicId(null);
  }, []);

  const handleTopicDrop = useCallback(
    async (targetId: string) => {
      if (!draggingConversationId) return;

      const conversation = conversations.find(
        (conv) => conv.id === draggingConversationId,
      );
      if (!conversation) {
        setDraggingConversationId(null);
        setDragOverTopicId(null);
        return;
      }

      // The Unsorted row is virtual, so dropping on it clears the topic.
      const nextFolderId = targetId === UNSORTED_TOPIC_ID ? null : targetId;
      if ((conversation.folderId ?? null) === nextFolderId) {
        setDraggingConversationId(null);
        setDragOverTopicId(null);
        return;
      }

      try {
        await assignConversationToFolder(draggingConversationId, nextFolderId);
      } catch (error) {
        console.error("Failed to move conversation via drag & drop", error);
        notifyError(t("folders.error_generic"));
      } finally {
        setDraggingConversationId(null);
        setDragOverTopicId(null);
      }
    },
    [conversations, draggingConversationId, notifyError, t],
  );

  function onClose() {
    dispatch(toggleSidebar());
  }

  const [createTopicAnchor, setCreateTopicAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleCreateFolder = (anchor: { x: number; y: number }) => {
    if (sidebarIsDocked) {
      setCreateTopicAnchor(anchor);
      return;
    }
    openModal("createFolder");
  };

  const handleRenameFolder = (folder: {
    id: string;
    name: string;
    color?: string;
    icon?: string;
  }) => {
    openModal("renameFolder", {
      folderId: folder.id,
      initialName: folder.name,
      initialColor: folder.color ?? null,
      initialIcon: folder.icon ?? null,
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
    openModal("moveChat", {
      conversationId: conv.id,
      conversationTitle: conv.title || "Untitled Chat",
      currentFolderId: conv.folderId ?? null,
      folders,
      localState,
      setLocalState,
    });
  };

  const highlightText = (text?: string | null) => {
    const value =
      text ||
      t("conversation.untitled", { defaultValue: "Untitled Chat" });
    if (!hasSearch) return value;
    const escapeRegExp = (str: string) =>
      str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  const handleSelectConversation = (id) => {
    if (id === currentConversationId) return;
    setSelectedConversationId(id); // update selected now for nicer user interaction
    navigate(`/chat/${id}`);
    if (!isDesktop) {
      onClose();
    }
  };

  const onNewConversation = (folderId) => {
    // New conversations start unsorted; the user files them into a topic after.
    handleNewConversation(folderId || null)
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

    openModal("renameChat", {
      id: conv.id,
      currentTitle: conv.title || "Untitled Chat",
      localState: localState,
      setLocalState: setLocalState,
    });
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
        (ref) => ref && ref.contains(event.target),
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

  const renderConversationRow = (conv) => {
    if (!conv) return null;
    const id = conv.id;
    const isActive = id === selectedConversationId;
    const isHovered = hoveredId === id;
    const isMenuOpen = activeMenu === id;
    const isDragging = draggingConversationId === id;

    return (
      <div
        key={id}
        onClick={() => handleSelectConversation(id)}
        draggable
        onDragStart={(event) => handleConversationDragStart(event, id)}
        onDragEnd={handleConversationDragEnd}
        className={`group relative px-2 py-1 rounded-xl touch-manipulation border border-transparent ${
          isActive
            ? "bg-gray-100 dark:bg-gray-800 text-black dark:text-white shadow-sm"
            : "text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-100"
        } ${isDragging ? "border-tertiary/60 bg-tertiary/10 dark:bg-tertiary/20" : ""}`}
        data-current={isActive ? "true" : "false"}
        style={{
          WebkitTapHighlightColor: "transparent",
          minHeight: "16px",
        }}
      >
        {/* Title container */}
        <div className="flex items-center h-full w-full group">
          <div
            className="flex-1 overflow-hidden min-w-0"
            title={conv.title || "Untitled Chat"}
            onDoubleClick={(e) => handleTitleDoubleClick(e, conv)}
            style={{ cursor: isDesktop ? "text" : "pointer" }}
          >
            <div className="truncate text-xs leading-relaxed cursor-pointer">
              {highlightText(conv.title)}
            </div>
          </div>

          {/* Dropdown Menu Button */}
          <div
            className={`transition-opacity duration-200 ${
              window.innerWidth < 1024 || isHovered || isActive || isMenuOpen
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
              <OverflowMenuVertical size={16} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex flex-col select-none h-full w-full transition-all duration-200 ease-in-out"
      style={{
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 gap-2">
        <AiServicesMenu />
        <ShortcutTooltip
          label={t("sidebar.close_sidebar")}
          position="left"
          enterDelay={150}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={t("sidebar.close_sidebar")}
            className="cursor-pointer p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all duration-200 flex items-center justify-center text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50"
          >
            <ChevronLeft size={20} />
          </button>
        </ShortcutTooltip>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Conversations header, with the search field it reveals */}
        <div className="sticky top-0 z-20 bg-white dark:bg-bg_secondary_dark px-3 pt-3 pb-2 shadow-[0_2px_6px_rgba(15,23,42,0.08)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between gap-1 pb-3">
            <NewChatButton topicId={localState?.folderId} variant={"sidebar"} onNewConversation={handleNewConversation} />
          <div className="flex items-center justify-between gap-1">
            <ImportPersonaButton topicId={localState?.folderId} variant={"sidebar"} />
            <ImportChatButton topicId={localState?.folderId} variant={"sidebar"} />
          </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t("folders.title")}
            </span>
            <button
              type="button"
              onClick={openSearch}
              className={`flex items-center rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer ${
                searchVisible ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
              aria-label={t("folders.search_label")}
            >
              <Search size={16} />
            </button>
          </div>
          <div
            className={`relative overflow-hidden transform-gpu transition-[max-height,opacity,transform,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              searchVisible
                ? "max-h-16 opacity-100 pt-3 pb-1 translate-y-0"
                : "max-h-0 opacity-0 pt-0 pb-0 -translate-y-1 pointer-events-none"
            }`}
          >
            <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40  transition">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  e.preventDefault();
                  if (hasSearch) {
                    setSearchQuery("");
                  } else {
                    setSearchOpen(false);
                  }
                }}
                placeholder={t("folders.search_placeholder")}
                className="w-full bg-transparent pl-9 pr-9 py-2 text-xs text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none"
              />
              {searchQuery.length > 0 ? (
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  aria-label={t("folders.clear_search")}
                  onClick={() => setSearchQuery("")}
                >
                  <Close size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  aria-label={t("common.cancel")}
                  onClick={closeSearch}
                >
                  <Close size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Conversations, grouped by topic */}
          <div className="pl-3 pr-2 pt-2 pb-1 space-y-1">
            {hasSearch ? (
              <div className="space-y-1">
                {noSearchResults ? (
                  <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-4">
                    <Trans
                      i18nKey="folders.search_no_results"
                      values={{ query: searchQuery }}
                    />
                  </div>
                ) : (
                  visibleConversations.map((conv) => renderConversationRow(conv))
                )}
              </div>
            ) : (
              <TopicList
                topics={folders}
                conversationsByTopic={conversationsByTopic}
                unsortedConversations={unsortedConversations}
                onCreateTopic={handleCreateFolder}
                onRenameTopic={handleRenameFolder}
                onDeleteTopic={handleDeleteFolder}
                onNewConversation={onNewConversation}
                draggingConversationId={draggingConversationId}
                dragOverTopicId={dragOverTopicId}
                onDragEnterTopic={setDragOverTopicId}
                onDragLeaveTopic={(topicId) =>
                  setDragOverTopicId((current) =>
                    current === topicId ? null : current,
                  )
                }
                onDropTopic={handleTopicDrop}
                renderConversationRow={renderConversationRow}
                isDark={isDark}
              />
            )}
          </div>
        </div>

        {/* Pinned footer: the user block */}
        <div className="sticky bottom-0 bg-white dark:bg-bg_secondary_dark pt-3 pb-4 shadow-[0_-2px_6px_rgba(15,23,42,0.08)] dark:shadow-[0_-2px_6px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col gap-3 mx-3">
            {showUsageInSidebar && userData?.limits && (
              <div className="flex flex-col gap-2">
                <UserLimitsDisplay limits={userData.limits} variant="sidebar" />
                <OrgLimitsDisplay limits={userData.limits} variant="sidebar" />
              </div>
            )}
            <SidebarUserCard
              localState={localState}
              userData={userData}
              modelsData={modelsData}
            />
          </div>
        </div>
      </div>

      <TopicCreateBubble
        isOpen={createTopicAnchor !== null}
        onClose={() => setCreateTopicAnchor(null)}
        anchor={createTopicAnchor ?? { x: 0, y: 0 }}
      />

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
            {/* Rename chat menu item */}
            <RenameChatButton
              localState={localState}
              setLocalState={setLocalState}
              variant={"menu"}
              closeMenu={closeMenu}
              convId={activeMenu}
              conversations={conversations}
            />
            {/* Move chat menu item */}
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
              <FolderMoveTo size={14} />
              <Trans i18nKey="folders.move_action" />
            </button>

            {/* Export chat menu item */}
            <ExportChatButton
              localState={localState}
              setLocalState={setLocalState}
              variant={"menu"}
              closeMenu={closeMenu}
              convId={activeMenu}
            />

            {/* Summarize chat menu item - only if active chat */}
            {localState.id == activeMenu && (
              <SummarizeChatButton
                variant={"menu"}
                localState={localState}
                setLocalState={setLocalState}
                closeMenu={closeMenu}
              />
            )}
            
            {/* Delete chat menu item */}
            <DeleteChatButton
              localState={localState}
              setLocalState={setLocalState}
              variant={"menu"}
              closeMenu={closeMenu}
              convId={activeMenu}
              conversations={conversations}
            />
          </div>
        </div>
      )}
    </div>
  );
}
