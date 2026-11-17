import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useConversationList } from "../../db";
import { useWorkspaceChats, useWorkspaceList } from "../../db/workspaceDb";

function WorkspaceSessionsSection({
  workspaceId,
  name,
  showHeading,
  activeConversationId,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const chats = useWorkspaceChats(workspaceId);
  const conversations = useConversationList();
  const conversationsById = useMemo(
    () => new Map(conversations.map((conversation) => [conversation.id, conversation])),
    [conversations],
  );
  const rows = chats
    .map((chat) => conversationsById.get(chat.conversationId))
    .filter(Boolean);

  return (
    <section className="space-y-1" aria-label={name || workspaceId}>
      {showHeading && (
        <h3 className="truncate text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
          {name || workspaceId}
        </h3>
      )}
      {rows.length === 0 ? (
        <p className="text-[11px] text-base-content/50">
          {t("meta_chat.sessions_empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-0.5" data-guide="workspace-sessions-list">
          {rows.map((conversation) => {
            const title = conversation.title || t("conversation.untitled");
            const active = conversation.id === activeConversationId;
            return (
              <button
                key={conversation.id}
                type="button"
                data-guide="workspace-session-row"
                title={title}
                onClick={() => navigate(`/chat/${conversation.id}`)}
                className={`relative flex items-center gap-1 rounded-xl border border-transparent px-2 py-1 w-full min-w-0 truncate text-left text-xs leading-relaxed ${
                  active
                    ? "bg-base-200 text-base-content shadow-sm"
                    : "text-base-content hover:bg-base-200 transition-all duration-100"
                }`}
              >
                {title}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function WorkspaceSessionsPanel({
  workspaceIds,
  activeConversationId,
}) {
  const workspaces = useWorkspaceList();
  const namesById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace.name])),
    [workspaces],
  );
  const ids = workspaceIds ?? [];

  return (
    <div className="w-full space-y-3">
      {ids.map((workspaceId) => (
        <WorkspaceSessionsSection
          key={workspaceId}
          workspaceId={workspaceId}
          name={namesById.get(workspaceId)}
          showHeading={ids.length > 1}
          activeConversationId={activeConversationId}
        />
      ))}
    </div>
  );
}
