import { useRef } from "react";
import type { DragEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Add, ChevronDown, Edit, TrashCan } from "@carbon/icons-react";

import type { FolderRow } from "../../db/dbTypes";
import { topicColor, topicTint, withAlpha } from "./topicColors";
import { topicIcon } from "./topicIcons";

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
  collapsedIds,
  onToggleCollapse,
  onCreateTopic,
  onRenameTopic,
  onDeleteTopic,
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
  collapsedIds: Set<string>;
  onToggleCollapse: (topicId: string) => void;
  onCreateTopic: (anchor: { x: number; y: number }) => void;
  onRenameTopic: (topic: TopicRef) => void;
  onDeleteTopic: (topic: TopicRef) => void;
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

  const renderRow = (options: {
    id: string;
    label: string;
    conversations: any[];
    hex: string;
    Icon?: ReturnType<typeof topicIcon> | null;
    topic?: TopicRef;
  }) => {
    const { id, label, conversations, hex, Icon, topic } = options;
    const isCollapsed = collapsedIds.has(id);
    const isDropTarget =
      draggingConversationId !== null && dragOverTopicId === id;
    const count = conversations.length;

    return (
      <div key={id}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={!isCollapsed}
          onClick={() => onToggleCollapse(id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleCollapse(id);
            }
          }}
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
            onDragLeaveTopic(id);
          }}
          onDrop={(e: DragEvent<HTMLDivElement>) => {
            if (!draggingConversationId) return;
            e.preventDefault();
            onDropTopic(id);
          }}
          className={`group flex items-center gap-2 rounded-2xl px-3 py-2 text-xs transition cursor-pointer border border-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40 ${
            isDropTarget ? "border-tertiary/60" : ""
          }`}
          style={
            isDropTarget ? { backgroundColor: topicTint(hex, isDark) } : undefined
          }
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
            className="flex-1 truncate select-none pointer-events-none"
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
            className="ml-3 pl-2 border-l space-y-1 py-1"
            style={{ borderColor: withAlpha(hex, isDark ? 0.5 : 0.35) }}
          >
            {count > 0 ? (
              conversations.map((conv) => renderConversationRow(conv))
            ) : (
              <p className="px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400">
                {t("folders.empty_topic")}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        ref={createButtonRef}
        onClick={() => {
          const rect = createButtonRef.current?.getBoundingClientRect();
          onCreateTopic({ x: rect?.right ?? 0, y: rect?.top ?? 0 });
        }}
        className="w-full flex items-center gap-2 rounded-2xl px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition cursor-pointer"
      >
        <Add size={16} className="flex-shrink-0" />
        <span className="truncate">{t("folders.create_button")}</span>
      </button>

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
