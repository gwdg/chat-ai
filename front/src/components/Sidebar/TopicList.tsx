import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router";
import {
  BookmarkAdd,
  Calendar,
  ChevronDown,
  Edit,
  OverflowMenuVertical,
  Pin,
  PinFilled,
  SortAscending,
  TrashCan,
} from "@carbon/icons-react";

import type { FolderRow } from "../../db/dbTypes";
import { topicColor, withAlpha } from "./topicColors";
import { isTopicIconId, topicIcon } from "./topicIcons";

import { useModal } from "../../modals/ModalContext";
import { selectCollapsedTopics, toggleTopic } from "../../Redux/reducers/interfaceSettingsSlice";

/**
 * The virtual topic holding conversations with no `folderId`. It is a UI
 * grouping only — no row for it exists in the database.
 */
export const UNSORTED_TOPIC_ID = "__unsorted__";
export const DATE_TOPIC_ID = "__by_date__";
export const CREATED_TOPIC_ID = "__by_created__";

type TopicRef = {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  pinned?: boolean;
};
type DateGroup = { key: string; conversations: any[] };

export const dateBucketCollapseId = (parentId: string, key: string) =>
  `${parentId}:${key}`;

export default function TopicList({
  topics,
  pinnedTopics,
  pinnedConversations,
  conversationsByTopic,
  unsortedConversations,
  onCreateTopic,
  onRenameTopic,
  onDeleteTopic,
  onToggleTopicPinned,
  onOpenTopic,
  draggingConversationId,
  dragOverTopicId,
  onDragEnterTopic,
  onDragLeaveTopic,
  onDropTopic,
  renderConversationRow,
  dateGroups,
  creationDateGroups,
  isDark,
  grouping,
}: {
  topics: FolderRow[];
  pinnedTopics: FolderRow[];
  pinnedConversations: any[];
  conversationsByTopic: Map<string, any[]>;
  unsortedConversations: any[];
  onCreateTopic: (anchor: { x: number; y: number }) => void;
  onRenameTopic: (topic: TopicRef) => void;
  onDeleteTopic: (topic: TopicRef) => void;
  onToggleTopicPinned: (topic: TopicRef) => void;
  onOpenTopic: (topicId: string) => void;
  draggingConversationId: string | null;
  dragOverTopicId: string | null;
  onDragEnterTopic: (topicId: string) => void;
  onDragLeaveTopic: (topicId: string) => void;
  onDropTopic: (topicId: string) => void;
  renderConversationRow: (
    conv: any,
    options?: {
      showMetadata?: boolean;
      showModified?: boolean;
      showCreated?: boolean;
    },
  ) => ReactNode;
  dateGroups: DateGroup[];
  creationDateGroups: DateGroup[];
  isDark: boolean;
  grouping: "topic" | "date" | "created";
}) {
  const { t } = useTranslation();
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const { openModal } = useModal();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const activeTopicId = pathname.startsWith("/topic/")
    ? decodeURIComponent(pathname.slice("/topic/".length))
    : null;

  const collapsedTopicIds = useSelector(selectCollapsedTopics) || [];

  const [menuTopicId, setMenuTopicId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const toggleTopicCollapse = useCallback((topicId: string) => {
    console.log("Dispatching topic toggle", topicId);
    dispatch(toggleTopic(topicId));
  }, []);

  const closeTopicMenu = useCallback(() => {
    setMenuTopicId(null);
  }, []);

  const toggleTopicMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, topicId: string) => {
      event.stopPropagation();
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      setMenuTopicId((previous) => {
        if (previous === topicId) return null;
        setMenuPosition({ x: rect.right + 5, y: rect.top - 5 });
        return topicId;
      });
    },
    [],
  );

  useEffect(() => {
    if (!menuTopicId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const clickedOnButton = Object.values(menuButtonRefs.current).some(
        (ref) => ref && ref.contains(event.target as Node),
      );
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !clickedOnButton
      ) {
        closeTopicMenu();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTopicMenu();
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    document.addEventListener("keydown", handleEscape);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuTopicId, closeTopicMenu]);

  const renderRow = (options: {
    id: string;
    label: string;
    conversations: any[];
    hex: string;
    Icon?: ReturnType<typeof topicIcon> | null;
    emoji?: string | null;
    topic?: TopicRef;
  }) => {
    const { id, label, conversations, hex, Icon, emoji, topic } = options;
    const isCollapsed = collapsedTopicIds.includes(id);
    const isDropTarget =
      draggingConversationId !== null && dragOverTopicId === id;
    const isActiveTopic = activeTopicId === id;
    const count = conversations.length;

    return (
      <div 
        key={id} 
        className="group"
        onDragEnter={(e) => {
          if (!draggingConversationId) return;
          e.preventDefault();
          onDragEnterTopic(id);
        }}
        onDragOver={(e) => {
          if (!draggingConversationId) return;
          e.preventDefault();
        }}
        onDragLeave={() => {
          if (!draggingConversationId) return;
        }}
        onDrop={(e: DragEvent<HTMLDivElement>) => {
          if (!draggingConversationId) return;
          e.preventDefault();
          onDropTopic(id);
        }} 
      >
        <div
          role="button"
          tabIndex={0}
          aria-current={isActiveTopic ? "page" : undefined}
          onClick={() => onOpenTopic(id)}
          onKeyDown={(e) => {
            // Let the collapse/options buttons handle their own keys.
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenTopic(id);
            }
          }}
          className={`group flex items-center gap-2 rounded-2xl px-1 py-2 text-xs transition cursor-pointer border text-base-content hover:bg-base-200 ${
            isActiveTopic
              ? "border-accent/40 bg-base-200"
              : "border-transparent"
          } ${isDropTarget ? "border-accent/60" : ""}`}
          // style={ isDropTarget ? { backgroundColor: topicTint(hex, isDark) } : undefined }
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleTopicCollapse(id);
            }}
            aria-expanded={!isCollapsed}
            aria-label={
              isCollapsed
                ? t("folders.expand_topic")
                : t("folders.collapse_topic")
            }
            className="flex-shrink-0 rounded-lg p-1 text-base-content/50 transition-colors hover:bg-base-300"
          >
            <ChevronDown
              size={12}
              className={`pointer-events-none transition-transform duration-200 ${
                isCollapsed ? "-rotate-90" : "rotate-0"
              }`}
            />
          </button>

          {emoji ? (
            <span
              aria-hidden="true"
              className="flex-shrink-0 pointer-events-none text-sm leading-none"
              style={{ color: hex }}
            >
              {emoji}
            </span>
          ) : Icon ? (
            <Icon
              size={16}
              className="flex-shrink-0 pointer-events-none"
              style={{ color: hex }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full flex-shrink-0 pointer-events-none"
              style={{ backgroundColor: withAlpha(hex, isDark ? 0.7 : 0.5) }}
            />
          )}

          <span
            className="flex-1 truncate select-none pointer-events-none font-medium"
            title={label}
          >
            {label}
          </span>

          <span className="text-[11px] select-none pointer-events-none font-semibold text-base-content/70">
            {count > 999 ? "999+" : count}
          </span>

          {topic && (
            <button
              type="button"
              ref={(el) => {
                menuButtonRefs.current[id] = el;
              }}
              onClick={(e) => toggleTopicMenu(e, id)}
              data-guide="topic-menu"
              aria-label={t("folders.topic_options")}
              aria-haspopup="menu"
              aria-expanded={menuTopicId === id}
              className={`flex-shrink-0 rounded-lg p-1 hover:bg-base-300 transition ${
                menuTopicId === id || window.innerWidth < 1024
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <OverflowMenuVertical
                size={16}
                className="text-base-content/70"
              />
            </button>
          )}
        </div>

        {!isCollapsed && (
          <div
            className="ml-2 pl-2 border-l flex flex-col gap-1"
            style={{ borderColor: withAlpha(hex, isDark ? 0.5 : 0.35) }}
          >
            {count > 0 && (
              conversations.map((conv) => renderConversationRow(conv))
            ) }
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1.5 pt-1" data-guide="topic-list">
      {(pinnedTopics.length > 0 || pinnedConversations.length > 0) && (
        <div
          data-guide="pinned-chats"
          className="flex flex-col gap-1 pb-1 mb-1 border-b border-base-300"
        >
          <div className="flex items-center gap-2 px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/70">
            <PinFilled size={12} className="flex-shrink-0" />
            <span className="truncate">{t("folders.pinned")}</span>
          </div>
          {pinnedTopics.map((topic) => {
            const color = topicColor(topic);
            const emoji =
              topic.icon && !isTopicIconId(topic.icon) ? topic.icon : null;
            return renderRow({
              id: topic.id,
              label: topic.name,
              conversations: conversationsByTopic.get(topic.id) ?? [],
              hex: color.hex,
              Icon: emoji ? null : topicIcon(topic),
              emoji,
              topic,
            });
          })}
          {pinnedConversations.map((conv) =>
            renderConversationRow(conv, { showModified: true }),
          )}
        </div>
      )}
      {grouping === "topic" && (
        <>
          <div className={`group flex items-center gap-2 rounded-2xl px-1 py-2 text-xs transition cursor-pointer border border-transparent text-base-content hover:bg-base-200`}>
      <button
        type="button"
        ref={createButtonRef}
        onClick={() => {
          const rect = createButtonRef.current?.getBoundingClientRect();
          onCreateTopic({ x: rect?.right ?? 0, y: rect?.top ?? 0 });
        }}
        data-guide="create-topic"
        className="w-full flex items-center text-xs text-secondary dark:text-primary font-semibold cursor-pointer"
      >
        <BookmarkAdd size={18} className="flex-shrink-0" />
          <span className="truncate px-2">{t("folders.create_button")}</span>
      </button>
      </div>
      {topics.map((topic) => {
        const color = topicColor(topic);
        const emoji =
          topic.icon && !isTopicIconId(topic.icon) ? topic.icon : null;
        return renderRow({
          id: topic.id,
          label: topic.name,
          conversations: conversationsByTopic.get(topic.id) ?? [],
          hex: color.hex,
          Icon: emoji ? null : topicIcon(topic),
          emoji,
          topic,
        });
      })}

      {renderRow({
        id: UNSORTED_TOPIC_ID,
        label: t("folders.uncategorized"),
        conversations: unsortedConversations,
        hex: isDark ? "#94A3B8" : "#64748B",
        Icon: null,
      })}
        </>
      )}

      {(grouping === "date" || grouping === "created") && (
        <div className="flex flex-col gap-1">
          <div className="px-2 pt-3 pb-1 text-[10px] font-semibold text-base-content/70">
            {t(grouping === "created" ? "folders.by_created" : "folders.by_date")}
          </div>
          {(() => {
            const isCreated = grouping === "created";
            const parentId = isCreated ? CREATED_TOPIC_ID : DATE_TOPIC_ID;
            const groups = isCreated ? creationDateGroups : dateGroups;
            const ParentIcon = isCreated ? SortAscending : Calendar;
            return groups.map((group) => {
              const bucketId = dateBucketCollapseId(parentId, group.key);
              const bucketCollapsed = collapsedTopicIds.includes(bucketId);
              const bucketCount = group.conversations.length;
              return (
                <div key={group.key}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={!bucketCollapsed}
                    onClick={() => toggleTopicCollapse(bucketId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleTopicCollapse(bucketId);
                      }
                    }}
                    className="group flex items-center gap-2 rounded-2xl px-1 py-2 text-xs transition cursor-pointer border border-transparent text-base-content hover:bg-base-200"
                  >
                    <ParentIcon
                      size={14}
                      className="flex-shrink-0 pointer-events-none text-base-content/50"
                    />
                    <span className="flex-1 truncate select-none pointer-events-none font-semibold uppercase tracking-wide text-[10px] text-base-content/70">
                      {t(`folders.dateBuckets.${group.key}`)}
                    </span>
                    <span className="text-[11px] select-none pointer-events-none font-semibold text-base-content/70">
                      {bucketCount > 999 ? "999+" : bucketCount}
                    </span>
                    <ChevronDown
                      size={12}
                      className={`flex-shrink-0 pointer-events-none text-base-content/50 transition-transform duration-200 ${
                        bucketCollapsed ? "-rotate-90" : "rotate-0"
                      }`}
                    />
                  </div>
                  {!bucketCollapsed && (
                    <div className="flex flex-col gap-1">
                      {group.conversations.map((conv) =>
                        renderConversationRow(conv, {
                          showMetadata: false,
                          ...(isCreated
                            ? { showCreated: true }
                            : { showModified: true }),
                        }),
                      )}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {menuTopicId &&
        (() => {
          const topic =
            pinnedTopics.find((item) => item.id === menuTopicId) ||
            topics.find((item) => item.id === menuTopicId);
          if (!topic) return null;
          return (
            <div
              ref={menuRef}
              role="menu"
              className="fixed w-40 rounded-lg shadow-2xl ring-1 ring-black/10 dark:ring-white/10 border border-base-300"
              style={{
                left: `${menuPosition.x}px`,
                top: `${menuPosition.y}px`,
                zIndex: 999999,
                backgroundColor: "rgb(255, 255, 255)",
              }}
            >
              <div
                className="absolute inset-0 bg-base-100 rounded-lg"
                style={{ zIndex: -1 }}
              />
              <div className="p-1 bg-base-100 rounded-lg relative">
                <button
                  type="button"
                  role="menuitem"
                  data-guide="pin-topic-menu-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTopicPinned({
                      id: topic.id,
                      name: topic.name,
                      color: topic.color,
                      icon: topic.icon,
                      pinned: topic.pinned,
                    });
                    closeTopicMenu();
                  }}
                  className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-base-content transition-colors hover:bg-base-300"
                >
                  {topic.pinned ? (
                    <PinFilled size={14} />
                  ) : (
                    <Pin size={14} />
                  )}
                  {topic.pinned
                    ? t("folders.unpin_topic_action")
                    : t("folders.pin_topic_action")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRenameTopic({
                      id: topic.id,
                      name: topic.name,
                      color: topic.color,
                      icon: topic.icon,
                    });
                    closeTopicMenu();
                  }}
                  className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-base-content transition-colors hover:bg-base-300"
                >
                  <Edit size={14} />
                  {t("folders.edit_title")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTopic({ id: topic.id, name: topic.name });
                    closeTopicMenu();
                  }}
                  className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-error transition-colors hover:bg-error/10"
                >
                  <TrashCan size={14} />
                  {t("common.delete")}
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
