import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";
import {
  Add,
  Bot,
  ChevronDown,
  Edit,
  OverflowMenuVertical,
  TrashCan,
} from "@carbon/icons-react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";

import {
  selectCollapsedTopics,
  toggleTopic,
} from "../../Redux/reducers/interfaceSettingsSlice";

import { useConversationList } from "../../db";
import {
  deleteWorkspace,
  detachWorkspaceAgent,
  detachWorkspaceChat,
  useWorkspaceAgentLinks,
  useWorkspaceAgentSessionLinks,
  useWorkspaceChatLinks,
  useWorkspaceList,
} from "../../db/workspaceDb";
import { useAgents } from "../../agents/agentStore";
import {
  fetchAgentSessions,
  sessionSummariesFor,
} from "../../agents/agentSessions";
import {
  createWorkspaceAgentSession,
  detachSessionFromWorkspace,
  filterSessionTree,
  openWorkspaceAgentSession,
  workspaceSessionIds,
} from "../../agents/workspaceAgentSessions";
import AgentSessionList from "../Agent/AgentSessionList";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";
import { topicIconById } from "../Sidebar/topicIcons";
import { topicColor, withAlpha } from "../Sidebar/topicColors";

export default function WorkspaceList({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal, confirmAction } = useModal();
  const { notifyError } = useToast();
  const workspaces = useWorkspaceList();
  const chatLinks = useWorkspaceChatLinks();
  const agentLinks = useWorkspaceAgentLinks();
  const sessionLinks = useWorkspaceAgentSessionLinks();
  const agents = useAgents();
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
  const agentsByWorkspace = useMemo(() => {
    const map = new Map<string, typeof agents>();
    for (const link of agentLinks) {
      const agent = agents.find((item) => item.id === link.agentId);
      if (!agent) continue;
      const rows = map.get(link.workspaceId) ?? [];
      rows.push(agent);
      map.set(link.workspaceId, rows);
    }
    return map;
  }, [agentLinks, agents]);
  const initializedChatExpansion = useRef<Set<string>>(new Set());
  const [sessionTrees, setSessionTrees] = useState<Record<string, any>>({});
  const [sessionRefresh, setSessionRefresh] = useState(0);
  const [creatingSession, setCreatingSession] = useState<string | null>(null);
  const loadedSessionAgents = useRef<Set<string>>(new Set());

  // Session titles come from the agent server; load them the first time a workspace with
  // agents is expanded, then keep them until the session list actually changes.
  useEffect(() => {
    const targets: any[] = [];
    for (const workspaceId of expandedChats) {
      for (const agent of agentsByWorkspace.get(workspaceId) ?? []) {
        if (loadedSessionAgents.current.has(agent.id)) continue;
        loadedSessionAgents.current.add(agent.id);
        targets.push(agent);
      }
    }
    if (!targets.length) return undefined;
    let cancelled = false;
    void Promise.all(
      targets.map(async (agent) => {
        try {
          const tree = await fetchAgentSessions(agent);
          if (cancelled) return;
          setSessionTrees((current) => ({ ...current, [agent.id]: tree }));
        } catch {
          // Keep the agent row usable; a later expand retries the listing.
          loadedSessionAgents.current.delete(agent.id);
        }
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [agentsByWorkspace, expandedChats, sessionRefresh]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const agentId = (event as CustomEvent)?.detail?.agentId;
      if (agentId) {
        loadedSessionAgents.current.delete(agentId);
        setSessionTrees((current) => {
          if (!(agentId in current)) return current;
          const next = { ...current };
          delete next[agentId];
          return next;
        });
      } else {
        loadedSessionAgents.current.clear();
        setSessionTrees({});
      }
      setSessionRefresh((value) => value + 1);
    };
    window.addEventListener("chatai:agent-sessions-changed", refresh);
    return () => {
      window.removeEventListener("chatai:agent-sessions-changed", refresh);
    };
  }, []);

  useEffect(() => {
    setExpandedChats((current) => {
      const next = new Set(current);
      let changed = false;
      for (const [workspaceId, chats] of chatsByWorkspace) {
        if (
          (chats.length > 0 || (agentsByWorkspace.get(workspaceId)?.length ?? 0) > 0) &&
          !initializedChatExpansion.current.has(workspaceId)
        ) {
          initializedChatExpansion.current.add(workspaceId);
          next.add(workspaceId);
          changed = true;
        }
      }
      for (const [workspaceId, attached] of agentsByWorkspace) {
        if (
          attached.length > 0 &&
          !initializedChatExpansion.current.has(workspaceId)
        ) {
          initializedChatExpansion.current.add(workspaceId);
          next.add(workspaceId);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [agentsByWorkspace, chatsByWorkspace]);
  const collapsedTopicIds = useSelector(selectCollapsedTopics) ?? [];
  const collapsed = collapsedTopicIds.includes("__workspaces__");

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
          {t("workspace.empty_sidebar_title")}
        </button>
      ) : (
        <div className="space-y-0.5">
          {workspaces.map((workspace) => {
            const active = location.pathname === `/workspace/${workspace.id}`;
            const chats = chatsByWorkspace.get(workspace.id) ?? [];
            const attachedAgents = agentsByWorkspace.get(workspace.id) ?? [];
            const expandable = chats.length > 0 || attachedAgents.length > 0;
            const expanded = expandedChats.has(workspace.id);
            const WorkspaceIcon = topicIconById(workspace.icon).Icon;
            const workspaceColor = topicColor({
              id: workspace.id,
              color: workspace.color,
            });
            return (
              <div key={workspace.id}>
                <div
                  className={`group flex items-center rounded-xl transition ${
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-base-content hover:bg-base-200"
                  }`}
                >
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
                    disabled={!expandable}
                    className={`ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/40 ${
                      expandable
                        ? "hover:text-base-content"
                        : "cursor-default opacity-40"
                    }`}
                    aria-expanded={expanded}
                    aria-label={t("workspace.attached_items")}
                  >
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/workspace/${workspace.id}`);
                      onNavigate?.();
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        color: workspaceColor.hex,
                        backgroundColor: withAlpha(
                          workspaceColor.hex,
                          active ? 0.2 : 0.12,
                        ),
                      }}
                    >
                      <WorkspaceIcon size={15} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {workspace.name}
                    </span>
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
                  <Popover className="relative mr-1">
                    <PopoverButton
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-base-content/40 opacity-0 transition hover:bg-base-300 hover:text-base-content group-hover:opacity-100 focus:outline-none"
                      title={t("workspace.workspace_options")}
                      aria-label={t("workspace.workspace_options")}
                    >
                      <OverflowMenuVertical size={16} />
                    </PopoverButton>
                    <PopoverPanel
                      anchor="bottom end"
                      className="z-50 w-44 rounded-xl border border-base-300 bg-base-100 p-1 shadow-lg"
                    >
                      {({ close }) => (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              close();
                              openModal("workspaceRename", {
                                workspaceId: workspace.id,
                                initialName: workspace.name,
                                initialIcon: workspace.icon,
                                initialColor: workspaceColor.id,
                              });
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/80 transition hover:bg-base-200"
                          >
                            <Edit size={14} />
                            {t("common.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              close();
                              remove(workspace);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-error transition hover:bg-error/10"
                          >
                            <TrashCan size={14} />
                            {t("workspace.delete_workspace")}
                          </button>
                        </>
                      )}
                    </PopoverPanel>
                  </Popover>
                </div>
                {expanded && expandable && (
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
                    {chats.length > 0 && attachedAgents.length > 0 && (
                      <div className="my-1 border-t border-base-300/70" />
                    )}
                    {attachedAgents.map((agent) => {
                      const sessionIds = workspaceSessionIds(
                        sessionLinks,
                        workspace.id,
                        agent.id,
                      );
                      const tree = sessionTrees[agent.id];
                      const scoped = tree
                        ? filterSessionTree(tree, sessionIds)
                        : null;
                      return (
                        <div key={agent.id}>
                          <div className="group/agent flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-base-200">
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/agent/${agent.id}`);
                                onNavigate?.();
                              }}
                              className="flex min-w-0 flex-1 items-center gap-1 text-left text-[11px] text-base-content/80"
                            >
                              <Bot
                                size={11}
                                className="shrink-0 text-base-content/45"
                              />
                              <span className="truncate">
                                {agent.name || agent.id}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={creatingSession === agent.id}
                              onClick={async () => {
                                if (creatingSession) return;
                                setCreatingSession(agent.id);
                                try {
                                  await createWorkspaceAgentSession(
                                    workspace.id,
                                    agent,
                                  );
                                  navigate(`/agent/${agent.id}`);
                                } catch (reason) {
                                  notifyError(
                                    reason instanceof Error
                                      ? reason.message
                                      : String(reason),
                                  );
                                } finally {
                                  setCreatingSession(null);
                                }
                              }}
                              className="flex h-4 w-4 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:text-accent group-hover/agent:opacity-100 disabled:opacity-50"
                              title={t("agents.new_session")}
                              aria-label={t("agents.new_session")}
                            >
                              {creatingSession === agent.id ? (
                                <span className="loading loading-spinner loading-xs" />
                              ) : (
                                <Add size={11} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void detachWorkspaceAgent(workspace.id, agent.id)
                              }
                              className="flex h-4 w-4 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:text-error group-hover/agent:opacity-100"
                              title={t("workspace.detach_agent")}
                              aria-label={t("workspace.detach_agent")}
                            >
                              ×
                            </button>
                          </div>
                          {scoped && scoped.all.length > 0 && (
                            <AgentSessionList
                              agent={agent}
                              tree={scoped}
                              activeSessionId={agent.sessionId}
                              summaries={sessionSummariesFor(agent)}
                              onSelect={(session) => {
                                void (async () => {
                                  await openWorkspaceAgentSession(
                                    workspace.id,
                                    agent,
                                    session,
                                  );
                                  navigate(`/agent/${agent.id}`);
                                })();
                                onNavigate?.();
                              }}
                              onDetach={(session) =>
                                void detachSessionFromWorkspace(
                                  workspace.id,
                                  agent,
                                  session,
                                )
                              }
                              showHeader={false}
                              emptyKey="agents.no_workspace_sessions"
                              className="ml-4 mt-0.5 border-0 bg-transparent p-0"
                            />
                          )}
                        </div>
                      );
                    })}
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
