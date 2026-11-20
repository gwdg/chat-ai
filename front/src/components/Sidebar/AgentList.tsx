import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";
import {
  Add,
  Bot,
  ChevronDown,
  Edit,
  OverflowMenuVertical,
  Pin,
  PinFilled,
  TrashCan,
} from "@carbon/icons-react";

import Tooltip from "../Others/Tooltip";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";
import {
  deleteOpencodeSession,
  getOpencodeInfo,
  getOpencodeSessionStatus,
  interruptOpencodeSession,
} from "../../apis/opencodeAgents";
import { deleteServiceAgent } from "../../apis/agentService";
import {
  addAgent,
  removeAgent,
  setAgentPinned,
  useAgents,
} from "../../agents/agentStore";
import {
  createAgentSession,
  fetchAgentSessions,
  notifyAgentSessionsChanged,
  sessionSummariesFor,
  switchAgentSession,
} from "../../agents/agentSessions";
import AgentSessionList from "../Agent/AgentSessionList";
import CloseGroupSessionsButton from "../Agent/CloseGroupSessionsButton";
import { activeSessionIdFor, useOpenAgent } from "../../hooks/useOpenAgent";
import {
  selectCollapsedTopics,
  selectExpandedAgents,
  toggleExpandedAgent,
  toggleTopic,
} from "../../Redux/reducers/interfaceSettingsSlice";
import {
  seedWorkspaceAgentSessions,
  useWorkspaceAgentLinks,
  useWorkspaceAgentSessionLinks,
  useWorkspaceList,
} from "../../db/workspaceDb";
import {
  agentWorkspaceIds,
  attachSessionToWorkspace,
  createWorkspaceAgentSession,
  detachSessionFromWorkspace,
  filterSessionTree,
  openWorkspaceAgentSession,
  sessionSubtreeIds,
  unassignedSessionIds,
  workspaceSessionIds,
  workspacesBySession,
} from "../../agents/workspaceAgentSessions";
import { topicIconById } from "./topicIcons";
import { pinnedStateId } from "./pinnedState";
import {
  agentProjectCollapseId,
  unassignedAgentCollapseId,
} from "./sessionGroupCollapse";
import {
  clearAgentSessionDrag,
  dropAgentSessionOnWorkspace,
  getActiveAgentSessionDrag,
  readAgentSessionDrag,
} from "./sessionDrop";

const canRemoveLocally = (reason: unknown) => {
  const message = String(reason instanceof Error ? reason.message : reason);
  return (
    reason instanceof TypeError ||
    /failed to fetch|networkerror|load failed|fetch failed|rejected the password|unauthorized|forbidden|not found|\b(401|403|404|502|503|504)\b/i.test(
      message,
    )
  );
};

const classifySessionStatus = (value: unknown) => {
  if (!value) return "ready";
  const status =
    typeof value === "string"
      ? value
      : String(
          (value as { type?: string; status?: string; state?: string }).type ??
            (value as { type?: string; status?: string; state?: string }).status ??
            (value as { type?: string; status?: string; state?: string }).state ??
            "",
        );
  if (/busy|running|working|active|pending|retry|permission/i.test(status)) {
    return "working";
  }
  if (/error|offline|failed|unavailable/i.test(status)) return "error";
  return "ready";
};

// Remote agents that will run on GWDG infrastructure. Each agent is backed by a session on a
// local opencode server; the HPC project list is still a placeholder.
export default function AgentList({
  variant = "all",
}: {
  /** "pinned" renders only pinned agents, without the section band. */
  variant?: "all" | "pinned";
} = {}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const openAgent = useOpenAgent();
  const { openModal } = useModal();
  const { notifyError } = useToast();
  const agents = useAgents();
  // The pinned section reuses these rows, so it renders only the pinned agents.
  const listedAgents = useMemo(
    () =>
      variant === "pinned"
        ? agents.filter((agent) => agent.pinned === true)
        : agents,
    [agents, variant],
  );
  const [removing, setRemoving] = useState<string | null>(null);
  const [sessionsByAgent, setSessionsByAgent] = useState<Record<string, any>>(
    {},
  );
  const [creatingSession, setCreatingSession] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<
    Record<string, "ready" | "working" | "error" | "checking">
  >({});
  const statusPollingRef = useRef<Promise<void> | null>(null);
  const workspaceLinks = useWorkspaceAgentLinks();
  const sessionLinks = useWorkspaceAgentSessionLinks();
  const workspaces = useWorkspaceList();
  const seededRef = useRef<Set<string>>(new Set());
  const collapsedTopicIds = useSelector(selectCollapsedTopics) ?? [];
  const expandedAgentIds = useSelector(selectExpandedAgents) ?? [];
  const collapsed = collapsedTopicIds.includes("__agents__");
  const activeId = openAgent.agentId;

  // A workspace group under an expanded agent lights up while one of that agent's
  // sessions is dragged over it; dropping there moves the session between workspaces.
  const [dragOverSessionGroup, setDragOverSessionGroup] = useState<{
    agentId: string;
    workspaceId: string;
  } | null>(null);

  const isDragOverSessionGroup = (agentId: string, workspaceId: string) =>
    dragOverSessionGroup?.agentId === agentId &&
    dragOverSessionGroup?.workspaceId === workspaceId;

  const handleSessionGroupDragOver = (
    event: DragEvent<HTMLDivElement>,
    agentId: string,
    workspaceId: string,
  ) => {
    // The groups under an agent list only that agent's sessions, so another
    // agent's session is not accepted here; the top-level workspace row takes it.
    if (getActiveAgentSessionDrag()?.agentId !== agentId) return;
    // Without preventDefault the browser never fires the drop event.
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    setDragOverSessionGroup((current) =>
      current?.agentId === agentId && current?.workspaceId === workspaceId
        ? current
        : { agentId, workspaceId },
    );
  };

  const handleSessionGroupDragLeave = (
    event: DragEvent<HTMLDivElement>,
    agentId: string,
    workspaceId: string,
  ) => {
    // dragleave also fires when the pointer moves onto a child of the group.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragOverSessionGroup((current) =>
      current?.agentId === agentId && current?.workspaceId === workspaceId
        ? null
        : current,
    );
  };

  const handleSessionGroupDrop = (
    event: DragEvent<HTMLDivElement>,
    agentId: string,
    workspaceId: string,
  ) => {
    const drag = readAgentSessionDrag(event.dataTransfer);
    if (!drag || drag.agentId !== agentId) return;
    event.preventDefault();
    event.stopPropagation();
    setDragOverSessionGroup(null);
    clearAgentSessionDrag();
    // A session dragged out of another workspace is detached from it first, so the
    // drop moves the link instead of attaching the same session to both.
    void dropAgentSessionOnWorkspace({
      agentId: drag.agentId,
      sessionId: drag.sessionId,
      targetWorkspaceId: workspaceId,
      sourceWorkspaceId: drag.workspaceId,
    }).catch((reason) => {
      console.error("Failed to move session via drag & drop", reason);
      notifyError(t("workspace.attach_session_error"));
    });
  };

  // The pinned copy is a second instance of this list, so its session folds are
  // keyed apart from the same agent in the Agents section.
  const expandId = (agentId: string) =>
    variant === "pinned" ? pinnedStateId(agentId) : agentId;

  // The pinned copy is a second instance of this list, so its folds are keyed
  // apart from the same group in the Agents section.
  const collapseId = (id: string) =>
    variant === "pinned" ? pinnedStateId(id) : id;

  // Make sure an agent attached to a workspace shows its active session there, even when the
  // workspace was attached before sessions were tracked per workspace.
  useEffect(() => {
    // Only the full list seeds workspace session links; the pinned copy is a view.
    if (variant === "pinned") return;
    for (const agent of agents) {
      for (const workspaceId of agentWorkspaceIds(workspaceLinks, agent.id)) {
        const key = `${workspaceId}:${agent.id}`;
        if (seededRef.current.has(key)) continue;
        seededRef.current.add(key);
        void seedWorkspaceAgentSessions(workspaceId, [agent]);
      }
    }
  }, [agents, workspaceLinks, variant]);

  useEffect(() => {
    let cancelled = false;
    const runPoll = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      const next: Record<
        string,
        "ready" | "working" | "error" | "checking"
      > = {};
      await Promise.all(
        listedAgents.map(async (agent) => {
          if (!agent.sessionId) {
            next[agent.id] = "error";
            return;
          }
          try {
            const statusMap = await getOpencodeSessionStatus(agent);
            next[agent.id] = classifySessionStatus(
              statusMap?.[agent.sessionId],
            );
          } catch {
            try {
              await getOpencodeInfo(agent);
              next[agent.id] = "ready";
            } catch {
              next[agent.id] = "error";
            }
          }
        }),
      );
      if (!cancelled) {
        setStatuses(next);
      }
    };
    const poll = async () => {
      while (statusPollingRef.current) {
        await statusPollingRef.current.catch(() => {});
      }
      if (cancelled || document.visibilityState === "hidden") return;
      const current = runPoll();
      statusPollingRef.current = current;
      try {
        await current;
      } finally {
        if (statusPollingRef.current === current) {
          statusPollingRef.current = null;
        }
      }
    };
    void poll();
    const timer = window.setInterval(poll, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [listedAgents]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      const next: Record<string, any[]> = {};
      await Promise.all(
        listedAgents.map(async (agent) => {
          try {
            next[agent.id] = await fetchAgentSessions(agent);
          } catch {
            next[agent.id] = [];
          }
        }),
      );
      if (!cancelled) setSessionsByAgent(next);
    };
    void load();
    const timer = window.setInterval(load, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [listedAgents]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const agentId = (event as CustomEvent).detail?.agentId;
      const agent = listedAgents.find((item) => item.id === agentId);
      if (!agent) return;
      void fetchAgentSessions(agent)
        .then((tree) =>
          setSessionsByAgent((current) => ({
            ...current,
            [agent.id]: tree,
          })),
        )
        .catch(() => {});
    };
    window.addEventListener("chatai:agent-sessions-changed", refresh);
    return () =>
      window.removeEventListener("chatai:agent-sessions-changed", refresh);
  }, [listedAgents]);

  const spawn = () =>
    openModal("agentAdd", {
      onCreate: (agent) => {
        addAgent(agent);
        navigate(`/agent/${agent.id}`);
      },
    });

  const remove = async (agent) => {
    if (removing) return;
    setRemoving(agent.id);
    try {
      if (agent.sessionId) {
        // Stop any running turn first, then delete the OpenCode session. Only remove the
        // local agent once the backend has terminated it successfully.
        await interruptOpencodeSession(agent, agent.sessionId).catch(() => {});
        await deleteOpencodeSession(agent, agent.sessionId);
      }
      if (agent.serviceAgentId) {
        // The service also owns the container/process, so deleting its agent is
        // what actually frees it. A 404 means somebody already did.
        await deleteServiceAgent(agent.serviceAgentId);
      }
      removeAgent(agent.id);
      if (agent.id === activeId) navigate("/chat");
    } catch (reason) {
      if (canRemoveLocally(reason)) {
        // The agent server is gone; still allow removing the local agent entry.
        removeAgent(agent.id);
        if (agent.id === activeId) navigate("/chat");
        notifyError(t("agents.removed_locally"));
      } else {
        notifyError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      setRemoving(null);
    }
  };

  // Agent session lists start collapsed, so only expansions are persisted.
  const expandAgent = (agentId) => {
    const key = expandId(agentId);
    if (!expandedAgentIds.includes(key)) {
      dispatch(toggleExpandedAgent(key));
    }
  };

  const createSession = async (agent, workspaceId?: string) => {
    if (creatingSession) return;
    setCreatingSession(agent.id);
    try {
      if (workspaceId) {
        await createWorkspaceAgentSession(workspaceId, agent);
      } else {
        await createAgentSession(agent);
        notifyAgentSessionsChanged(agent.id);
      }
      const tree = await fetchAgentSessions(agent);
      setSessionsByAgent((current) => ({
        ...current,
        [agent.id]: tree,
      }));
      expandAgent(agent.id);
      navigate(`/agent/${agent.id}`);
    } catch (reason) {
      notifyError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setCreatingSession(null);
    }
  };

  const switchSession = (agent, session, workspaceId?: string) => {
    if (workspaceId) void openWorkspaceAgentSession(workspaceId, agent, session);
    else switchAgentSession(agent, session.id);
    expandAgent(agent.id);
    navigate(`/agent/${agent.id}`);
  };

  // The row menu moves one session between the agent's workspaces; the live session links
  // re-group the sidebar on their own. `nextAttached` is the state the row asked for.
  const toggleSessionWorkspace = async (
    agent,
    session,
    workspaceId: string,
    nextAttached: boolean,
  ) => {
    try {
      if (nextAttached) {
        await attachSessionToWorkspace(workspaceId, agent, session);
      } else {
        await detachSessionFromWorkspace(workspaceId, agent, session);
      }
    } catch (reason) {
      notifyError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const toggleSessions = (agentId) => {
    dispatch(toggleExpandedAgent(expandId(agentId)));
  };

  const header = variant === "all" && (
    <div className="-mx-2 mb-1 flex min-h-8 items-center gap-1 rounded-lg bg-base-200/70 px-3 py-1">
      <button
        type="button"
        onClick={() => dispatch(toggleTopic("__agents__"))}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-md text-left text-[11px] font-semibold uppercase tracking-wide text-base-content/70 transition hover:text-base-content"
        aria-expanded={!collapsed}
      >
        <ChevronDown
          size={12}
          className={`shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
        />
        <Bot size={12} className="shrink-0" />
        <Tooltip text={t("agents.tooltip")}>
          <span className="truncate">{t("agents.section_title")}</span>
        </Tooltip>
        <span className="ml-1 font-normal tabular-nums text-base-content/35">
          {listedAgents.length}
        </span>
      </button>
      <button
        type="button"
        onClick={spawn}
        data-guide="agents-spawn"
        className="flex h-6 w-6 items-center justify-center rounded-md text-base-content/50 transition hover:bg-base-200 hover:text-accent"
        title={t("agents.spawn")}
        aria-label={t("agents.spawn")}
      >
        <Add size={15} />
      </button>
    </div>
  );

  const body = (variant === "all" && collapsed) ? null : listedAgents.length === 0 ? (
    <p className="px-1 py-1 text-[10px] text-base-content/50">
      {t("agents.empty")}
    </p>
  ) : (
    <div className="space-y-0.5">
      {listedAgents.map((agent) => {
        const active = agent.id === activeId;
        const status = statuses[agent.id] ?? "checking";
        const statusLabel = t(`agents.status_${status}`);
        const statusClass =
          status === "ready"
            ? "bg-success"
            : status === "working"
              ? "bg-warning animate-pulse"
              : status === "error"
                ? "bg-error"
                : "bg-base-content/20";
        const sessionTree = sessionsByAgent[agent.id];
        const sessionOpen = expandedAgentIds.includes(expandId(agent.id));
        return (
          <div key={agent.id}>
            <div
              className={`group relative flex min-h-[16px] items-center rounded-xl px-2 py-1 ${
                active
                  ? "bg-base-200 text-base-content shadow-sm"
                  : "text-base-content transition-all duration-100 hover:bg-base-200"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSessions(agent.id)}
                className="flex h-5 w-4 shrink-0 items-center justify-center rounded text-base-content/40 hover:bg-base-300 hover:text-base-content"
                title={t("agents.sessions")}
                aria-label={t("agents.sessions")}
                aria-expanded={sessionOpen}
              >
                <ChevronDown
                  size={12}
                  className={sessionOpen ? "" : "-rotate-90"}
                />
              </button>
              <button
                type="button"
                onClick={() => navigate(`/agent/${agent.id}`)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                title={agent.serverUrl}
              >
                <span
                  className="flex w-3 shrink-0 justify-center"
                  title={statusLabel}
                  aria-label={statusLabel}
                  role="status"
                >
                  <span className={`h-2 w-2 rounded-full ${statusClass}`} />
                </span>
                <Bot size={14} className="shrink-0 text-base-content/50" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs leading-relaxed">
                    {agent.name}
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-base-content/70">
                    {agent.serverUrl}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void createSession(agent)}
                disabled={creatingSession === agent.id}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-base-content/45 transition hover:bg-base-300 hover:text-base-content disabled:opacity-50"
                title={t("agents.new_session")}
                aria-label={t("agents.new_session")}
              >
                {creatingSession === agent.id ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Add size={14} />
                )}
              </button>
              {removing === agent.id ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <span className="loading loading-spinner loading-xs" />
                </span>
              ) : (
                <Popover className="relative shrink-0">
                  <PopoverButton
                    data-guide="agent-menu"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-base-content/40 opacity-0 transition hover:bg-base-300 hover:text-base-content focus:opacity-100 group-hover:opacity-100"
                    title={t("agents.options")}
                    aria-label={t("agents.options")}
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
                            setAgentPinned(agent.id, agent.pinned !== true);
                          }}
                          data-guide="pin-agent-menu-item"
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/80 transition hover:bg-base-200"
                        >
                          {agent.pinned ? (
                            <PinFilled size={14} />
                          ) : (
                            <Pin size={14} />
                          )}
                          {t(
                            agent.pinned
                              ? "agents.unpin_action"
                              : "agents.pin_action",
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            openModal("agentEdit", { agent });
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
                            void remove(agent);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-error transition hover:bg-error/10"
                        >
                          <TrashCan size={14} />
                          {t("agents.remove")}
                        </button>
                      </>
                    )}
                  </PopoverPanel>
                </Popover>
              )}
            </div>
            {sessionOpen && (() => {
              const agentWorkspaces = agentWorkspaceIds(
                workspaceLinks,
                agent.id,
              )
                .map((workspaceId) =>
                  workspaces.find((workspace) => workspace.id === workspaceId),
                )
                .filter(Boolean);
              const assignedWorkspaces = workspacesBySession(
                sessionLinks,
                agent.id,
              );
              const toggleWorkspace = (workspaceId, session, nextAttached) =>
                void toggleSessionWorkspace(
                  agent,
                  session,
                  workspaceId,
                  nextAttached,
                );
              const unassigned = unassignedSessionIds(
                sessionTree,
                sessionLinks,
                agent.id,
              );
              const unassignedKey = collapseId(
                unassignedAgentCollapseId(agent.id),
              );
              const unassignedOpen = !collapsedTopicIds.includes(unassignedKey);
              if (agentWorkspaces.length === 0) {
                return (
                  <AgentSessionList
                    agent={agent}
                    tree={sessionTree}
                    activeSessionId={activeSessionIdFor(openAgent, agent)}
                    summaries={sessionSummariesFor(agent)}
                    workspaces={[]}
                    onSelect={(session) => switchSession(agent, session)}
                    onCreate={createSession}
                    creating={creatingSession === agent.id}
                    showCreate={false}
                    className="mt-1 ml-4"
                  />
                );
              }
              return (
                <div className="mt-1 ml-4 space-y-1">
                  {agentWorkspaces.map((workspace) => {
                    const sessionIds = workspaceSessionIds(
                      sessionLinks,
                      workspace.id,
                      agent.id,
                    );
                    const groupKey = collapseId(
                      agentProjectCollapseId(workspace.id, agent.id),
                    );
                    const sessionsOpen = !collapsedTopicIds.includes(groupKey);
                    const WorkspaceIcon = topicIconById(workspace.icon).Icon;
                    return (
                      <div
                        key={workspace.id}
                        data-session-group={workspace.id}
                        data-guide="agent-session-group"
                        onDragOver={(event) =>
                          handleSessionGroupDragOver(
                            event,
                            agent.id,
                            workspace.id,
                          )
                        }
                        onDragLeave={(event) =>
                          handleSessionGroupDragLeave(
                            event,
                            agent.id,
                            workspace.id,
                          )
                        }
                        onDrop={(event) =>
                          handleSessionGroupDrop(event, agent.id, workspace.id)
                        }
                        className={`rounded-lg transition ${
                          isDragOverSessionGroup(agent.id, workspace.id)
                            ? "bg-accent/5 ring-2 ring-accent/60"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] text-base-content/55">
                          <button
                            type="button"
                            disabled={sessionIds.size === 0}
                            onClick={() => dispatch(toggleTopic(groupKey))}
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-base-content/40 ${
                              sessionIds.size > 0
                                ? "hover:bg-base-300 hover:text-base-content"
                                : "cursor-default opacity-30"
                            }`}
                            title={t("agents.sessions_in_workspace", {
                              workspace: workspace.name,
                            })}
                            aria-label={t("agents.sessions_in_workspace", {
                              workspace: workspace.name,
                            })}
                            aria-expanded={
                              sessionIds.size > 0 ? sessionsOpen : false
                            }
                          >
                            <ChevronDown
                              size={11}
                              className={`transition-transform ${
                                sessionsOpen ? "" : "-rotate-90"
                              }`}
                            />
                          </button>
                          <WorkspaceIcon size={11} className="shrink-0" />
                          <button
                            type="button"
                            onClick={() => navigate(`/workspace/${workspace.id}`)}
                            className="min-w-0 flex-1 truncate text-left hover:text-base-content"
                          >
                            {workspace.name}
                          </button>
                          <CloseGroupSessionsButton
                            agent={agent}
                            sessionIds={[
                              ...sessionSubtreeIds(sessionTree, sessionIds),
                            ]}
                            groupName={workspace.name}
                          />
                          <span className="shrink-0 tabular-nums text-base-content/35">
                            {sessionIds.size}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void createSession(agent, workspace.id)
                            }
                            disabled={creatingSession === agent.id}
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-base-content/40 hover:bg-base-300 hover:text-base-content disabled:opacity-50"
                            title={t("agents.new_session")}
                            aria-label={t("agents.new_session")}
                          >
                            {creatingSession === agent.id ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              <Add size={11} />
                            )}
                          </button>
                        </div>
                        {sessionsOpen && (
                          <AgentSessionList
                            agent={agent}
                            tree={filterSessionTree(sessionTree, sessionIds)}
                            dragSourceWorkspaceId={workspace.id}
                            activeSessionId={activeSessionIdFor(
                              openAgent,
                              agent,
                            )}
                            summaries={sessionSummariesFor(agent)}
                            workspaces={agentWorkspaces}
                            sessionWorkspaceIds={assignedWorkspaces}
                            onToggleWorkspace={toggleWorkspace}
                            onSelect={(session) =>
                              switchSession(agent, session, workspace.id)
                            }
                            onDetach={(session) =>
                              void detachSessionFromWorkspace(
                                workspace.id,
                                agent,
                                session,
                              )
                            }
                            showHeader={false}
                            showCreate={false}
                            emptyKey="agents.no_workspace_sessions"
                            className="ml-2"
                          />
                        )}
                      </div>
                    );
                  })}
                  {unassigned.size > 0 && (
                    <div>
                      <div className="flex items-center gap-1 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/45">
                        <button
                          type="button"
                          onClick={() => dispatch(toggleTopic(unassignedKey))}
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-base-content/40 hover:bg-base-300 hover:text-base-content"
                          title={t("agents.sessions_in_workspace", {
                            workspace: t("agents.unassigned_sessions"),
                          })}
                          aria-label={t("agents.sessions_in_workspace", {
                            workspace: t("agents.unassigned_sessions"),
                          })}
                          aria-expanded={unassignedOpen}
                        >
                          <ChevronDown
                            size={11}
                            className={`transition-transform ${
                              unassignedOpen ? "" : "-rotate-90"
                            }`}
                          />
                        </button>
                        <span className="min-w-0 flex-1 truncate">
                          {t("agents.unassigned_sessions")}
                        </span>
                        <CloseGroupSessionsButton
                          agent={agent}
                          sessionIds={[
                            ...sessionSubtreeIds(sessionTree, unassigned),
                          ]}
                          groupName={t("agents.unassigned_sessions")}
                        />
                      </div>
                      {unassignedOpen && (
                        <AgentSessionList
                          agent={agent}
                          tree={filterSessionTree(sessionTree, unassigned)}
                          dragSourceWorkspaceId={null}
                          activeSessionId={activeSessionIdFor(
                            openAgent,
                            agent,
                          )}
                          summaries={sessionSummariesFor(agent)}
                          workspaces={agentWorkspaces}
                          sessionWorkspaceIds={assignedWorkspaces}
                          onToggleWorkspace={toggleWorkspace}
                          onSelect={(session) => switchSession(agent, session)}
                          showHeader={false}
                          showCreate={false}
                          emptyKey="agents.no_unassigned_sessions"
                          className="ml-2"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );

  if (variant === "pinned") {
    return listedAgents.length === 0 ? null : (
      <div data-guide="pinned-agents">{body}</div>
    );
  }

  return (
    <div className="px-3 pt-3 pb-1" data-guide="agents-list">
      {header}
      {body}
    </div>
  );
}
