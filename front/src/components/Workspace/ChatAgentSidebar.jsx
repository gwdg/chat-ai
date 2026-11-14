import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
  Settings,
} from "lucide-react";

import { useAgents } from "../../agents/agentStore";
import {
  createAgentSession,
  fetchAgentSessions,
  notifyAgentSessionsChanged,
  switchAgentSession,
} from "../../agents/agentSessions";
import {
  getOpencodeInfo,
  getOpencodeSession,
  getOpencodeSessionStatus,
  listOpencodeFiles,
  listOpencodeMessages,
} from "../../apis/opencodeAgents";
import {
  useChatWorkspaces,
  useWorkspaceAgentLinks,
} from "../../db/workspaceDb";
import MetaChangesPanel from "../Meta/MetaChangesPanel";
import AgentSessionList from "../Agent/AgentSessionList";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";

const classifySessionStatus = (value) => {
  if (!value) return "ready";
  const status =
    typeof value === "string"
      ? value
      : String(value?.type ?? value?.status ?? value?.state ?? "");
  if (/busy|running|working|active|pending|retry|permission/i.test(status)) {
    return "working";
  }
  if (/error|offline|failed|unavailable/i.test(status)) return "error";
  return "ready";
};

const messageText = (message) => {
  if (message?.type === "user") return String(message.text || "").trim();
  const parts = message?.content ?? message?.parts ?? [];
  return parts
    .map((part) => {
      if (part?.type === "text") return part.text || "";
      if (part?.type === "tool") return `[tool: ${part.name || "tool"}]`;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
};

export default function ChatAgentSidebar({ conversationId }) {
  const { t } = useTranslation();
  const userSettings = useSelector(selectUserSettings);
  const navigate = useNavigate();
  const agents = useAgents();
  const chatLinks = useChatWorkspaces(conversationId);
  const agentLinks = useWorkspaceAgentLinks();
  const [statuses, setStatuses] = useState({});
  const [expanded, setExpanded] = useState(new Set());
  const [details, setDetails] = useState({});
  const [sessions, setSessions] = useState({});
  const [creatingSession, setCreatingSession] = useState(null);

  const connectedAgents = useMemo(() => {
    const workspaceIds = new Set(
      (chatLinks || []).map((link) => link.workspaceId),
    );
    const ids = new Set(
      (agentLinks || [])
        .filter((link) => workspaceIds.has(link.workspaceId))
        .map((link) => link.agentId),
    );
    return agents.filter(
      (agent) =>
        ids.has(agent.id) ||
        (agent.bridgeWorkspaceId &&
          workspaceIds.has(agent.bridgeWorkspaceId)),
    );
  }, [agents, agentLinks, chatLinks]);

  useEffect(() => {
    if (!connectedAgents.length) {
      setStatuses({});
      return;
    }
    let cancelled = false;
    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      const next = {};
      await Promise.all(
        connectedAgents.map(async (agent) => {
          if (!agent.sessionId) {
            next[agent.id] = "error";
            return;
          }
          try {
            const map = await getOpencodeSessionStatus(agent);
            next[agent.id] = classifySessionStatus(map?.[agent.sessionId]);
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
      if (!cancelled) setStatuses(next);
    };
    void poll();
    const timer = window.setInterval(poll, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [connectedAgents]);

  useEffect(() => {
    for (const agentId of expanded) {
      const agent = connectedAgents.find((item) => item.id === agentId);
      if (!agent) continue;
      void fetchAgentSessions(agent)
        .then((tree) =>
          setSessions((current) => ({ ...current, [agentId]: tree })),
        )
        .catch(() => {});
    }
  }, [connectedAgents, expanded]);

  useEffect(() => {
    const refresh = (event) => {
      const agentId = event.detail?.agentId;
      const agent = connectedAgents.find((item) => item.id === agentId);
      if (!agent) return;
      void fetchAgentSessions(agent)
        .then((tree) =>
          setSessions((current) => ({ ...current, [agentId]: tree })),
        )
        .catch(() => {});
    };
    window.addEventListener("chatai:agent-sessions-changed", refresh);
    return () =>
      window.removeEventListener("chatai:agent-sessions-changed", refresh);
  }, [connectedAgents]);

  useEffect(() => {
    for (const agentId of expanded) {
      if (details[agentId]) continue;
      const agent = connectedAgents.find((item) => item.id === agentId);
      if (!agent?.sessionId) continue;
      void (async () => {
        const [session, messages, files] = await Promise.all([
          getOpencodeSession(agent, agent.sessionId).catch(() => null),
          listOpencodeMessages(agent, agent.sessionId).catch(() => []),
          listOpencodeFiles(agent, "").catch(() => []),
        ]);
        setDetails((current) => ({
          ...current,
          [agentId]: { session, messages, files },
        }));
      })();
    }
  }, [connectedAgents, details, expanded]);

  if (!connectedAgents.length) return null;

  const createSession = async (agent) => {
    if (creatingSession) return;
    setCreatingSession(agent.id);
    try {
      await createAgentSession(agent);
      notifyAgentSessionsChanged(agent.id);
      const tree = await fetchAgentSessions(agent);
      setSessions((current) => ({ ...current, [agent.id]: tree }));
      navigate(`/agent/${agent.id}`);
    } finally {
      setCreatingSession(null);
    }
  };

  const switchSession = (agent, session) => {
    switchAgentSession(agent, session.id);
    navigate(`/agent/${agent.id}`);
  };

  const toggle = (agentId) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  return (
    <MetaChangesPanel userSettings={userSettings}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
        {t("workspace.agent_sidebar_title")}
      </p>
      <div className="space-y-2">
        {connectedAgents.map((agent) => {
          const status = statuses[agent.id] ?? "checking";
          const statusClass =
            status === "ready"
              ? "bg-success"
              : status === "working"
                ? "bg-warning animate-pulse"
                : status === "error"
                  ? "bg-error"
                  : "bg-base-content/20";
          const open = expanded.has(agent.id);
          const data = details[agent.id];
          return (
            <div
              key={agent.id}
              className="rounded-lg border border-base-300 p-2"
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusClass}`} />
                <Bot size={12} className="shrink-0 text-base-content/50" />
                <button
                  type="button"
                  onClick={() => navigate(`/agent/${agent.id}`)}
                  className="min-w-0 flex-1 truncate text-left text-xs font-medium"
                >
                  {agent.name}
                </button>
                <button
                  type="button"
                  onClick={() => toggle(agent.id)}
                  className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 hover:bg-base-200"
                  aria-label={t("workspace.agent_details")}
                >
                  {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              </div>
              {open && (
                <div className="mt-2 space-y-2 text-[10px] text-base-content/70">
                  <AgentSessionList
                    agent={agent}
                    tree={sessions[agent.id]}
                    activeSessionId={agent.sessionId}
                    onSelect={(session) => switchSession(agent, session)}
                    onCreate={createSession}
                    creating={creatingSession === agent.id}
                    className="text-[10px]"
                  />
                  <div>
                    <p className="mb-0.5 flex items-center gap-1 font-semibold text-base-content/60">
                      <Settings size={11} /> {t("workspace.agent_settings")}
                    </p>
                    <p className="truncate">
                      {data?.session?.model?.name ||
                        data?.session?.model?.id ||
                        agent.serverUrl}
                    </p>
                    <p className="truncate">
                      {agent.local === false ? "remote" : "local"} ·{" "}
                      {agent.sessionId}
                    </p>
                  </div>
                  <div>
                    <p className="mb-0.5 flex items-center gap-1 font-semibold text-base-content/60">
                      <History size={11} /> {t("workspace.agent_history")}
                    </p>
                    {data?.messages?.length ? (
                      <ul className="space-y-1">
                        {data.messages
                          .slice(-4)
                          .map((message) => {
                            const text = messageText(message);
                            return text
                              ? (
                                  <li key={message.id} className="line-clamp-2">
                                    {message.type}: {text.slice(0, 160)}
                                  </li>
                                )
                              : null;
                          })}
                      </ul>
                    ) : (
                      <p className="text-base-content/45">
                        {t("workspace.no_agent_history")}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="mb-0.5 flex items-center gap-1 font-semibold text-base-content/60">
                      <FileText size={11} /> {t("workspace.agent_files")}
                    </p>
                    {data?.files?.length ? (
                      <ul className="space-y-0.5">
                        {data.files.slice(0, 8).map((file, index) => (
                          <li
                            key={file.path ?? index}
                            className="truncate"
                            title={file.path}
                          >
                            {file.type === "directory" ? "dir " : "file "}
                            {file.path}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-base-content/45">
                        {t("workspace.no_agent_files")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </MetaChangesPanel>
  );
}
