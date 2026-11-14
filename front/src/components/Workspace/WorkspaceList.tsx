import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";
import { Add, Bot, ChevronDown, ChevronRight, TrashCan } from "@carbon/icons-react";

import {
  selectCollapsedTopics,
  toggleTopic,
} from "../../Redux/reducers/interfaceSettingsSlice";

import { useConversationList } from "../../db";
import {
  deleteWorkspace,
  detachWorkspaceChat,
  syncWorkspacesFromServer,
  useWorkspaceChatLinks,
  useWorkspaceList,
} from "../../db/workspaceDb";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";

export default function WorkspaceList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal, confirmAction } = useModal();
  const { notifyError } = useToast();
  const workspaces = useWorkspaceList();
  const chatLinks = useWorkspaceChatLinks();
  const conversations = useConversationList() || [];
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set());
  const chatsByWorkspace = useMemo(() => {
    const map = new Map<string, typeof conversations>();
    for (const link of chatLinks) {
      const conversation = conversations.find(
        (item) => item.id === link.conversationId,
      );
      if (!conversation) continue;
      const rows = map.get(link.workspaceId) ?? [];
      rows.push(conversation);
      map.set(link.workspaceId, rows);
    }
    return map;
  }, [chatLinks, conversations]);
  const initializedChatExpansion = useRef<Set<string>>(new Set());
  useEffect(() => {
    setExpandedChats((current) => {
      const next = new Set(current);
      let changed = false;
      for (const [workspaceId, chats] of chatsByWorkspace) {
        if (
          chats.length > 0 &&
          !initializedChatExpansion.current.has(workspaceId)
        ) {
          initializedChatExpansion.current.add(workspaceId);
          next.add(workspaceId);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [chatsByWorkspace]);
  const collapsedTopicIds = useSelector(selectCollapsedTopics) ?? [];
  const collapsed = collapsedTopicIds.includes("__workspaces__");

  useEffect(() => {
    void syncWorkspacesFromServer();
  }, []);

  const create = () => openModal("workspaceCreate", {});

  const remove = (workspace: { id: string; name: string }) => {
    confirmAction(
      {
        warningKey: "warn_workspace_delete",
        messageKey: "workspace.delete_confirm",
        confirmKey: "workspace.delete_workspace",
        danger: true,
      },
      async () => {
        try {
          await deleteWorkspace(workspace.id);
          if (location.pathname === `/workspace/${workspace.id}`) navigate("/");
        } catch (error) {
          console.error("Failed to delete workspace", error);
          notifyError(t("workspace.delete_error"));
        }
      },
    );
  };

  return (
    <div className="px-3 pt-2 pb-1">
      <div className="mb-1 flex items-center gap-1 px-1">
        <button
          type="button"
          onClick={() => dispatch(toggleTopic("__workspaces__"))}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-md text-left text-[10px] font-semibold uppercase tracking-wider text-base-content/45 transition hover:text-base-content"
          aria-expanded={!collapsed}
        >
          <ChevronDown
            size={12}
            className={`shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <span className="truncate">{t("workspace.sidebar_title")}</span>
        </button>
        <button
          type="button"
          onClick={create}
          data-guide="workspace-add-source"
          className="flex h-6 w-6 items-center justify-center rounded-md text-base-content/50 transition hover:bg-base-200 hover:text-accent"
          title={t("workspace.new_workspace")}
          aria-label={t("workspace.new_workspace")}
        >
          <Add size={15} />
        </button>
      </div>

      {collapsed ? null : workspaces.length === 0 ? (
        <button
          type="button"
          onClick={create}
          className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-base-300 px-3 py-2 text-left text-xs text-base-content/60 transition hover:border-accent/40 hover:bg-base-200/60"
        >
          <Bot size={14} className="text-accent" />
          {t("workspace.empty_sidebar_title")}
        </button>
      ) : (
        <div className="space-y-0.5">
          {workspaces.map((workspace) => {
            const active = location.pathname === `/workspace/${workspace.id}`;
            const chats = chatsByWorkspace.get(workspace.id) ?? [];
            const expanded = expandedChats.has(workspace.id);
            return (
              <div key={workspace.id}>
                <div
                  className={`group flex items-center rounded-xl transition ${
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-base-content hover:bg-base-200"
                  }`}
                >
                  {chats.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedChats((current) => {
                          const next = new Set(current);
                          if (next.has(workspace.id)) next.delete(workspace.id);
                          else next.add(workspace.id);
                          return next;
                        })
                      }
                      className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/40 hover:text-base-content"
                      aria-expanded={expanded}
                      aria-label={t("workspace.attached_chats")}
                    >
                      <ChevronDown
                        size={12}
                        className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
                      />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/workspace/${workspace.id}`);
                      onNavigate?.();
                    }}
                    className={`flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left ${chats.length ? "" : "pl-2"}`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? "bg-accent/15 text-accent"
                          : "bg-base-200 text-base-content/55"
                      }`}
                    >
                      <Bot size={15} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {workspace.name}
                    </span>
                    <ChevronRight
                      size={14}
                      className="shrink-0 text-base-content/30 transition group-hover:opacity-100"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openModal("workspaceAttachChat", {
                        workspaceId: workspace.id,
                        conversations,
                        attachedIds: chats.map((chat) => chat.id),
                      })
                    }
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-base-content/40 opacity-0 transition hover:bg-base-300 hover:text-accent group-hover:opacity-100"
                    title={t("workspace.attach_chat")}
                    aria-label={t("workspace.attach_chat")}
                  >
                    <Add size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(workspace)}
                    className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-base-content/40 opacity-0 transition hover:bg-error/10 hover:text-error group-hover:opacity-100"
                    title={t("workspace.delete_workspace")}
                    aria-label={t("workspace.delete_workspace")}
                  >
                    <TrashCan size={14} />
                  </button>
                </div>
                {expanded && chats.length > 0 && (
                  <div className="mb-1 ml-8 flex flex-col gap-0.5 border-l border-base-300 pl-2">
                    {chats.map((chat) => (
                      <div
                        key={chat.id}
                        className="group/chat flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-base-200"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            navigate(`/chat/${chat.id}`);
                            onNavigate?.();
                          }}
                          className="min-w-0 flex-1 truncate text-left text-[11px] text-base-content/80"
                        >
                          {chat.title || t("conversation.untitled")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void detachWorkspaceChat(workspace.id, chat.id)
                          }
                          className="flex h-4 w-4 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:text-error group-hover/chat:opacity-100"
                          title={t("workspace.detach_chat")}
                          aria-label={t("workspace.detach_chat")}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
