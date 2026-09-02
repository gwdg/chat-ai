import { useCallback, useRef } from "react";
import type { DragEvent, ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Add, AddFilled, AddAlt, BookmarkAdd, ChevronDown, Edit, TrashCan, UserAvatar, Bot } from "@carbon/icons-react";

import type { FolderRow } from "../../db/dbTypes";
import { topicColor, topicTint, withAlpha } from "./topicColors";
import { topicIcon } from "./topicIcons";
import ImportChatButton from "./ImportChatButton";

import ShortcutTooltip from "./ShortcutTooltip";
import { useModal } from "../../modals/ModalContext";
import ImportPersonaButton from "./ImportPersonaButton";
import NewChatButton from "./NewChatButton";
import { selectCollapsedTopics, toggleTopic } from "../../Redux/reducers/interfaceSettingsSlice";

/**
 * The virtual topic holding conversations with no `folderId`. It is a UI
 * grouping only — no row for it exists in the database.
 */
export const UNSORTED_TOPIC_ID = "__unsorted__";

type TopicRef = { id: string; name: string; color?: string; icon?: string };

export default function TopicList({
  topics,
  conversationsByTopic,
  unsortedConversations,
  onCreateTopic,
  onRenameTopic,
  onDeleteTopic,
  onNewConversation,
  draggingConversationId,
  dragOverTopicId,
  onDragEnterTopic,
  onDragLeaveTopic,
  onDropTopic,
  renderConversationRow,
  isDark,
}: {
  topics: FolderRow[];
  conversationsByTopic: Map<string, any[]>;
  unsortedConversations: any[];
  onCreateTopic: (anchor: { x: number; y: number }) => void;
  onRenameTopic: (topic: TopicRef) => void;
  onDeleteTopic: (topic: TopicRef) => void;
  onNewConversation: (folderId: string | null) => void;
  draggingConversationId: string | null;
  dragOverTopicId: string | null;
  onDragEnterTopic: (topicId: string) => void;
  onDragLeaveTopic: (topicId: string) => void;
  onDropTopic: (topicId: string) => void;
  renderConversationRow: (conv: any) => ReactNode;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const { openModal } = useModal();
  const dispatch = useDispatch();

  const collapsedTopicIds = useSelector(selectCollapsedTopics) || [];

  const toggleTopicCollapse = useCallback((topicId: string) => {
    console.log("Dispatching topic toggle", topicId);
    dispatch(toggleTopic(topicId));
  }, []);

  const renderRow = (options: {
    id: string;
    label: string;
    conversations: any[];
    hex: string;
    Icon?: ReturnType<typeof topicIcon> | null;
    topic?: TopicRef;
  }) => {
    const { id, label, conversations, hex, Icon, topic } = options;
    const isCollapsed = collapsedTopicIds.includes(id);
    const isDropTarget =
      draggingConversationId !== null && dragOverTopicId === id;
    const count = conversations.length;

    return (
      <div 
        key={id} 
        className={`group
          isDropTarget ? "border-tertiary/60" : ""
        `}
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
          aria-expanded={!isCollapsed}
          onClick={() => toggleTopicCollapse(id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleTopicCollapse(id);
            }
          }}
          className={`group flex items-center gap-2 rounded-2xl px-1 py-2 text-xs transition cursor-pointer border border-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40 ${
            isDropTarget ? "border-tertiary/60" : ""
          }`}
          // style={ isDropTarget ? { backgroundColor: topicTint(hex, isDark) } : undefined }
        >
          {Icon ? (
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

          {topic && (
            <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameTopic(topic);
                }}
                aria-label={t("folders.rename_title")}
                className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <Edit size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTopic(topic);
                }}
                aria-label={t("folders.delete_title")}
                className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition"
              >
                <TrashCan size={14} />
              </button>
            </span>
          )}

          <span className="text-[11px] select-none pointer-events-none font-semibold text-gray-500 dark:text-gray-200">
            {count > 999 ? "999+" : count}
          </span>
          <ChevronDown
            size={12}
            className={`flex-shrink-0 pointer-events-none text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
              isCollapsed ? "-rotate-90" : "rotate-0"
            }`}
          />
        </div>

        {!isCollapsed && (
          <div
            className="ml-2 pl-2 border-l flex flex-col gap-1"
            style={{ borderColor: withAlpha(hex, isDark ? 0.5 : 0.35) }}
          >
            {count > 0 && (
              conversations.map((conv) => renderConversationRow(conv))
            ) }
            {/* New Chat / Persona / Import — sits after the list, and sticks to
                          the bottom edge once the list is long enough to scroll under it */}
            <div className="sticky bottom-0 z-10 bg-white dark:bg-bg_secondary_dark pr-3">
              <div className="flex items-center gap-1">
                <NewChatButton topicId={id} onNewConversation={onNewConversation} />
                <ImportPersonaButton topicId={id} />
                <ImportChatButton topicId={id} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <div className={`group flex items-center gap-2 rounded-2xl px-1 py-2 text-xs transition cursor-pointer border border-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40`}>
      <button
        type="button"
        ref={createButtonRef}
        onClick={() => {
          const rect = createButtonRef.current?.getBoundingClientRect();
          onCreateTopic({ x: rect?.right ?? 0, y: rect?.top ?? 0 });
        }}
        className="w-full flex items-center text-xs text-secondary font-semibold text-gray-500 cursor-pointer"
      >
        <BookmarkAdd size={18} className="flex-shrink-0" />
          <span className="truncate px-2">{t("folders.create_button")}</span>
      </button>
      </div>
      {topics.map((topic) => {
        const color = topicColor(topic);
        return renderRow({
          id: topic.id,
          label: topic.name,
          conversations: conversationsByTopic.get(topic.id) ?? [],
          hex: color.hex,
          Icon: topicIcon(topic),
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
    </div>
  );
}
