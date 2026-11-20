import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";
import {
  Add,
  Bot,
  ChevronDown,
  Edit,
  Link,
  OverflowMenuVertical,
  Pin,
  PinFilled,
  TrashCan,
  Workspace,
} from "@carbon/icons-react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";

import {
  selectCollapsedTopics,
  selectDarkMode,
  toggleTopic,
} from "../../Redux/reducers/interfaceSettingsSlice";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";
import { SECTION_RHYTHM } from "../Sidebar/sectionSpacing";

import { useConversationList } from "../../db";
import {
  createAttachedChat,
  deleteWorkspace,
  detachWorkspaceAgent,
  detachWorkspaceChat,
  setWorkspacePinned,
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
import { activeSessionIdFor, useOpenAgent } from "../../hooks/useOpenAgent";
import { topicIconById } from "../Sidebar/topicIcons";
import { pinnedStateId } from "../Sidebar/pinnedState";
import {
  chatRowTint,
  groupRowTint,
  groupRule,
  topicColor,
  withAlpha,
} from "../Sidebar/topicColors";
import {
  isChatDrag,
  readChatDrag,
  setChatDragData,
} from "../Sidebar/chatDrop";
import {
  isAgentSessionDrag,
  readAgentSessionDrag,
} from "../Sidebar/sessionDrop";
import { useDelayedSingleClick } from "../../hooks/useDelayedSingleClick";
import { useWindowSize } from "../../hooks/useWindowSize";
import { workspaceAgentCollapseId } from "../Sidebar/sessionGroupCollapse";
import { getDefaultConversation } from "../../utils/conversationUtils";

// Workspace rows and the agent rows inside them default to expanded, so only the
// ids the user folded are persisted. They share `collapsed_topics` with the chat
// topics and the subpanel headers, which already use synthetic ids there.
export const workspaceRowCollapseId = (workspaceId: string) =>
  `__workspace_row__:${workspaceId}`;

export default function WorkspaceList({
  onNavigate,
  variant = "all",
  draggingConversationId = null,
  onChatDragStart,
  onChatDragEnd,
  onChatDrop,
  onSessionDrop,
}: {
  onNavigate?: () => void;
  /** "pinned" renders only pinned workspaces, without the section band. */
  variant?: "all" | "pinned";
  /** The chat row currently being dragged, wherever it came from. */
  draggingConversationId?: string | null;
  /** Called when a chat row inside a workspace starts being dragged out. */
  onChatDragStart?: (conversationId: string, workspaceId: string) => void;
  onChatDragEnd?: () => void;
  /** Called when a dragged chat is dropped on a workspace row. */
  onChatDrop?: (payload: {
    conversationId: string;
    targetWorkspaceId: string;
    sourceWorkspaceId: string | null;
  }) => void | Promise<void>;
  /** Called when a dragged agent session is dropped on a workspace row. */
  onSessionDrop?: (payload: {
    agentId: string;
    sessionId: string;
    targetWorkspaceId: string;
    sourceWorkspaceId: string | null;
  }) => void | Promise<void>;
} = {}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const openAgent = useOpenAgent();
  const { openModal, confirmAction } = useModal();
  const { notifyError } = useToast();
  const workspaces = useWorkspaceList();
  // The pinned section reuses these rows, so it renders only the pinned ones.
  const listedWorkspaces = useMemo(
    () =>
      variant === "pinned"
        ? workspaces.filter((workspace) => workspace.pinned === true)
        : workspaces,
    [workspaces, variant],
  );
  const chatLinks = useWorkspaceChatLinks();
  const agentLinks = useWorkspaceAgentLinks();
  const sessionLinks = useWorkspaceAgentSessionLinks();
  const agents = useAgents();
  const conversations = useConversationList() || [];
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
  const [sessionTrees, setSessionTrees] = useState<Record<string, any>>({});
  const [sessionRefresh, setSessionRefresh] = useState(0);
  const [creatingSession, setCreatingSession] = useState<string | null>(null);
  const [creatingChat, setCreatingChat] = useState<string | null>(null);
  // Workspace row highlighted while a chat is dragged over it.
  const [dragOverWorkspaceId, setDragOverWorkspaceId] = useState<string | null>(
    null,
  );
  const loadedSessionAgents = useRef<Set<string>>(new Set());
  // A fetch may finish after the list re-rendered (attaching the agent changes
  // `agentsByWorkspace`), but only an unmount makes its result meaningless.
  // Cancelling on every dependency change left the agent marked as loaded with
  // no tree, so a session dropped onto a workspace never appeared.
  const sessionsMounted = useRef(true);
  useEffect(
    () => () => {
      sessionsMounted.current = false;
    },
    [],
  );
  const collapsedTopicIds = useSelector(selectCollapsedTopics) ?? [];
  const isDark = useSelector(selectDarkMode);
  const { isDesktop } = useWindowSize();
  const userSettings = useSelector(selectUserSettings);
  // Opening a workspace mounts another sidebar and destroys this row, so wait
  // out a possible second click before navigating.
  const { schedule: scheduleOpenWorkspace, cancel: cancelOpenWorkspace } =
    useDelayedSingleClick();

  // The pinned copy is a second instance of this list, so its folds are keyed
  // apart from the workspace rows in the Workspace section.
  const collapseId = (id: string) =>
    variant === "pinned" ? pinnedStateId(id) : id;

  // A workspace row is open unless the user folded it; it is only foldable when
  // something is attached. The same persisted list drives its agent rows below.
  const expandedWorkspaceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const workspace of listedWorkspaces) {
      const expandable =
        (chatsByWorkspace.get(workspace.id)?.length ?? 0) > 0 ||
        (agentsByWorkspace.get(workspace.id)?.length ?? 0) > 0;
      if (
        expandable &&
        !collapsedTopicIds.includes(
          collapseId(workspaceRowCollapseId(workspace.id)),
        )
      ) {
        ids.add(workspace.id);
      }
    }
    return ids;
  }, [
    listedWorkspaces,
    chatsByWorkspace,
    agentsByWorkspace,
    collapsedTopicIds,
    variant,
  ]);

  // Session titles come from the agent server; load them the first time a workspace with
  // agents is expanded, then keep them until the session list actually changes.
  useEffect(() => {
    const targets: any[] = [];
    for (const workspaceId of expandedWorkspaceIds) {
      for (const agent of agentsByWorkspace.get(workspaceId) ?? []) {
        if (loadedSessionAgents.current.has(agent.id)) continue;
        loadedSessionAgents.current.add(agent.id);
        targets.push(agent);
      }
    }
    if (!targets.length) return undefined;
    void Promise.all(
      targets.map(async (agent) => {
        try {
          const tree = await fetchAgentSessions(agent);
          if (!sessionsMounted.current) return;
          setSessionTrees((current) => ({ ...current, [agent.id]: tree }));
        } catch {
          // Keep the agent row usable; a later expand retries the listing.
          loadedSessionAgents.current.delete(agent.id);
        }
      }),
    );
  }, [agentsByWorkspace, expandedWorkspaceIds, sessionRefresh]);

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

  const collapsed = collapsedTopicIds.includes("__workspaces__");

  const create = () => openModal("workspaceCreate", {});

  // The "+" of a workspace row starts a chat that belongs to that workspace
  // right away. Attaching an existing chat stays available in the workspace's
  // Chats panel.
  const createChat = async (workspaceId: string) => {
    if (creatingChat) return;
    setCreatingChat(workspaceId);
    try {
      const id = await createAttachedChat(
        workspaceId,
        getDefaultConversation(userSettings),
      );
      navigate(`/chat/${id}`, { state: { openWorkspacePanel: true } });
      onNavigate?.();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setCreatingChat(null);
    }
  };

  // Dragging a chat or an agent session onto a workspace row attaches it; a
  // link dragged out of another workspace moves with it. Only the sidebar's
  // private MIME types are accepted, so file or text drags keep their own
  // meaning.
  const acceptsWorkspaceDrag = (dataTransfer: DataTransfer | null) =>
    isChatDrag(dataTransfer) || isAgentSessionDrag(dataTransfer);

  const handleWorkspaceDragOver = (
    event: DragEvent<HTMLDivElement>,
    workspaceId: string,
  ) => {
    if (!acceptsWorkspaceDrag(event.dataTransfer)) return;
    // Without preventDefault the browser never fires the drop event.
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverWorkspaceId((current) =>
      current === workspaceId ? current : workspaceId,
    );
  };

  const handleWorkspaceDragLeave = (
    event: DragEvent<HTMLDivElement>,
    workspaceId: string,
  ) => {
    // dragleave also fires when the pointer moves onto a child of the row.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragOverWorkspaceId((current) =>
      current === workspaceId ? null : current,
    );
  };

  const handleWorkspaceDrop = (
    event: DragEvent<HTMLDivElement>,
    workspaceId: string,
  ) => {
    if (!acceptsWorkspaceDrag(event.dataTransfer)) return;
    event.preventDefault();
    setDragOverWorkspaceId(null);

    if (isChatDrag(event.dataTransfer)) {
      const drag = readChatDrag(event.dataTransfer);
      if (!drag) return;
      void onChatDrop?.({
        conversationId: drag.conversationId,
        targetWorkspaceId: workspaceId,
        sourceWorkspaceId: drag.workspaceId,
      });
      return;
    }

    const drag = readAgentSessionDrag(event.dataTransfer);
    if (!drag) return;
    void onSessionDrop?.({
      agentId: drag.agentId,
      sessionId: drag.sessionId,
      targetWorkspaceId: workspaceId,
      sourceWorkspaceId: drag.workspaceId,
    });
  };

  // A double click on the workspace's name area folds or unfolds its attached
  // items, like the trailing chevron. The action buttons keep their own clicks.
  const toggleWorkspaceCollapse = (
    workspaceId: string,
    expandable: boolean,
  ) => {
    if (!expandable) return;
    dispatch(toggleTopic(collapseId(workspaceRowCollapseId(workspaceId))));
  };

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

  const header = variant === "all" && (
    <div className="-ml-2 -mr-1 mb-1 flex min-h-8 items-center gap-1 rounded-lg bg-base-200/70 px-3 py-1">
      <button
        type="button"
        onClick={() => dispatch(toggleTopic("__workspaces__"))}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-md text-left text-[11px] font-semibold uppercase tracking-wide text-base-content/70 transition hover:text-base-content"
        aria-expanded={!collapsed}
      >
        <ChevronDown
          size={12}
          className={`shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
        />
        <Workspace size={12} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {t("workspace.sidebar_title")}
        </span>
      </button>
      <span className="text-[11px] font-normal tabular-nums text-base-content/35">
        {listedWorkspaces.length}
      </span>
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
  );

  const body = (variant === "all" && collapsed) ? null : listedWorkspaces.length === 0 ? (
    <button
      type="button"
      onClick={create}
      className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-base-300 px-3 py-2 text-left text-xs text-base-content/60 transition hover:border-accent/40 hover:bg-base-200/60"
    >
      {t("workspace.empty_sidebar_title")}
    </button>
  ) : (
    <div className="space-y-0.5">
      {listedWorkspaces.map((workspace) => {
        const active = location.pathname === `/workspace/${workspace.id}`;
        const chats = chatsByWorkspace.get(workspace.id) ?? [];
        const attachedAgents = agentsByWorkspace.get(workspace.id) ?? [];
        const expandable = chats.length > 0 || attachedAgents.length > 0;
        const expanded = expandedWorkspaceIds.has(workspace.id);
        const WorkspaceIcon = topicIconById(workspace.icon).Icon;
        const workspaceColor = topicColor({
          id: workspace.id,
          color: workspace.color,
        });
        return (
          <div key={workspace.id}>
            <div
              data-guide="workspace-row"
              onDragEnter={(event) => handleWorkspaceDragOver(event, workspace.id)}
              onDragOver={(event) => handleWorkspaceDragOver(event, workspace.id)}
              onDragLeave={(event) =>
                handleWorkspaceDragLeave(event, workspace.id)
              }
              onDrop={(event) => handleWorkspaceDrop(event, workspace.id)}
              className={`group flex min-h-9 cursor-pointer items-center rounded-lg px-1 transition bg-[var(--group-tint)] hover:bg-[var(--group-tint-hover)] ${
                active ? "text-accent" : "text-base-content"
              } ${
                dragOverWorkspaceId === workspace.id
                  ? "ring-2 ring-accent/60 ring-offset-0"
                  : ""
              }`}
              style={
                {
                  "--group-tint": groupRowTint(workspaceColor.hex, isDark, {
                    active,
                  }),
                  "--group-tint-hover": groupRowTint(
                    workspaceColor.hex,
                    isDark,
                    { active, hover: true },
                  ),
                } as CSSProperties
              }
            >
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    toggleTopic(collapseId(workspaceRowCollapseId(workspace.id))),
                  )
                }
                disabled={!expandable}
                className={`mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-base-content/40 ${
                  expandable
                    ? "cursor-pointer hover:text-base-content"
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
                onClick={(event) => {
                  // The second click of a double click folds the row instead.
                  if (event.detail > 1) {
                    cancelOpenWorkspace();
                    return;
                  }
                  scheduleOpenWorkspace(() => {
                    // Opening a workspace also unfolds its right-hand Files panel.
                    navigate(`/workspace/${workspace.id}`, {
                      state: { openWorkspacePanel: true },
                    });
                    onNavigate?.();
                  });
                }}
                onDoubleClick={() => {
                  cancelOpenWorkspace();
                  toggleWorkspaceCollapse(workspace.id, expandable);
                }}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch text-left"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
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
              <span className="mx-1 shrink-0 text-[11px] tabular-nums font-semibold text-base-content/70">
                {chats.length > 999 ? "999+" : chats.length}
              </span>
              <button
                type="button"
                disabled={creatingChat === workspace.id}
                onClick={() => void createChat(workspace.id)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-base-content/40 opacity-0 transition hover:bg-base-300 hover:text-accent group-hover:opacity-100 disabled:opacity-50"
                title={t("workspace.new_chat")}
                aria-label={t("workspace.new_chat")}
              >
                {creatingChat === workspace.id ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Add size={14} />
                )}
              </button>
              <Popover className="relative">
                <PopoverButton
                  data-guide="workspace-menu"
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
                          openModal("workspaceEdit", {
                            workspaceId: workspace.id,
                          });
                        }}
                        data-guide="workspace-manage"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/80 transition hover:bg-base-200"
                      >
                        <Edit size={14} />
                        {t("workspace.manage_workspace")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          openModal("workspaceAttachAgentSession", {
                            workspaceId: workspace.id,
                            agents,
                            sessionLinks,
                          });
                        }}
                        data-guide="attach-agent-session-menu-item"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/80 transition hover:bg-base-200"
                      >
                        <Link size={14} />
                        {t("workspace.attach_agent_session")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          void setWorkspacePinned(
                            workspace.id,
                            workspace.pinned !== true,
                          );
                        }}
                        data-guide="pin-workspace-menu-item"
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/80 transition hover:bg-base-200"
                      >
                        {workspace.pinned ? (
                          <PinFilled size={14} />
                        ) : (
                          <Pin size={14} />
                        )}
                        {t(
                          workspace.pinned
                            ? "workspace.unpin_action"
                            : "workspace.pin_action",
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          remove(workspace);
                        }}
                        data-guide="delete-workspace-menu-item"
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
              <div
                className="ml-2 flex flex-col gap-1 border-x-2 px-2"
                style={{
                  borderColor: groupRule(workspaceColor.hex, isDark),
                }}
              >
                {chats.map((chat) => {
                  const chatActive = location.pathname === `/chat/${chat.id}`;
                  const chatDragging = draggingConversationId === chat.id;
                  return (
                    <div
                      key={chat.id}
                      data-guide="workspace-chat-row"
                      draggable
                      onDragStart={(event) => {
                        setChatDragData(event.dataTransfer, chat.id, workspace.id);
                        onChatDragStart?.(chat.id, workspace.id);
                      }}
                      onDragEnd={() => onChatDragEnd?.()}
                      className={`group/chat relative -mx-2 flex items-center gap-1 border border-transparent px-2 py-1 ${
                        chatActive
                          ? "bg-[var(--chat-tint)] text-base-content"
                          : "text-base-content hover:bg-[var(--chat-tint-hover)] transition-all duration-100"
                      } ${
                        chatDragging
                          ? "border-accent/60 bg-accent/10 dark:bg-accent/20"
                          : ""
                      }`}
                      style={{
                        "--chat-tint": chatRowTint(
                          workspaceColor.hex,
                          isDark,
                          { active: true },
                        ),
                        "--chat-tint-hover": chatRowTint(
                          workspaceColor.hex,
                          isDark,
                          { hover: true },
                        ),
                      } as CSSProperties}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/chat/${chat.id}`, {
                            state: { openWorkspacePanel: true },
                          });
                          onNavigate?.();
                        }}
                        aria-current={chatActive ? "page" : undefined}
                        className="min-w-0 flex-1 truncate text-left text-xs leading-relaxed"
                        style={{ cursor: isDesktop ? "text" : "pointer" }}
                      >
                        {chat.title || t("conversation.untitled")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void detachWorkspaceChat(workspace.id, chat.id)
                        }
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base-content/40 opacity-0 transition-all duration-200 hover:bg-base-300 hover:text-error group-hover/chat:opacity-100"
                        title={t("workspace.detach_chat")}
                        aria-label={t("workspace.detach_chat")}
                      >
                        <span className="text-[16px] leading-none">×</span>
                      </button>
                    </div>
                    );
                })}
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
                  // Per workspace and agent, so the same agent can be folded in one
                  // workspace and open in another. Collapsed ids live in the same
                  // persisted list the chat topics use, so the fold survives a reload.
                  const agentKey = collapseId(
                    workspaceAgentCollapseId(workspace.id, agent.id),
                  );
                  const sessionsOpen = !collapsedTopicIds.includes(agentKey);
                  const hasSessions = sessionIds.size > 0;
                  const agentActive = openAgent.agentId === agent.id;
                  return (
                    <div key={agent.id}>
                      <div
                        className={`group/agent flex items-center gap-1 rounded-md px-1 py-0.5 ${
                          agentActive
                            ? "bg-base-200 text-base-content"
                            : "hover:bg-base-200"
                        }`}
                      >
                        <button
                          type="button"
                          disabled={!hasSessions}
                          onClick={() => dispatch(toggleTopic(agentKey))}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-base-content/40 ${
                            hasSessions
                              ? "hover:bg-base-300 hover:text-base-content"
                              : "cursor-default opacity-30"
                          }`}
                          title={t("agents.sessions")}
                          aria-label={t("agents.sessions")}
                          aria-expanded={hasSessions ? sessionsOpen : false}
                        >
                          <ChevronDown
                            size={11}
                            className={`transition-transform ${
                              sessionsOpen ? "" : "-rotate-90"
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigate(`/agent/${agent.id}`);
                            onNavigate?.();
                          }}
                          aria-current={agentActive ? "page" : undefined}
                          className={`flex min-w-0 flex-1 items-center gap-1 text-left text-[11px] ${
                            agentActive
                              ? "font-medium text-base-content"
                              : "text-base-content/80"
                          }`}
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
                      {sessionsOpen && scoped && scoped.all.length > 0 && (
                        <AgentSessionList
                          agent={agent}
                          tree={scoped}
                          dragSourceWorkspaceId={workspace.id}
                          activeSessionId={activeSessionIdFor(
                            openAgent,
                            agent,
                          )}
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
  );

  if (variant === "pinned") {
    return listedWorkspaces.length === 0 ? null : (
      <div data-guide="pinned-workspaces">{body}</div>
    );
  }

  return (
    <div className={`pl-3 pr-2 ${SECTION_RHYTHM}`} data-guide="workspace-list">
      {header}
      {body}
    </div>
  );
}
