import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";
import { Add, Bot, ChevronDown, TrashCan } from "@carbon/icons-react";

import Tooltip from "../Others/Tooltip";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";
import {
  deleteOpencodeSession,
  interruptOpencodeSession,
} from "../../apis/opencodeAgents";
import {
  addAgent,
  removeAgent,
  useAgents,
} from "../../agents/agentStore";
import {
  selectCollapsedTopics,
  toggleTopic,
} from "../../Redux/reducers/interfaceSettingsSlice";

// Remote agents that will run on GWDG infrastructure. Each agent is backed by a session on a
// local opencode server; the HPC project list is still a placeholder.
export default function AgentList() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal } = useModal();
  const { notifyError } = useToast();
  const agents = useAgents();
  const [removing, setRemoving] = useState<string | null>(null);
  const collapsedTopicIds = useSelector(selectCollapsedTopics) ?? [];
  const collapsed = collapsedTopicIds.includes("__agents__");
  const activeId = location.pathname.startsWith("/agent/")
    ? location.pathname.slice("/agent/".length)
    : null;

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
      removeAgent(agent.id);
      if (agent.id === activeId) navigate("/chat");
    } catch (reason) {
      notifyError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="px-3 pt-2 pb-1" data-guide="agents-list">
      <div className="mb-1 flex items-center gap-1 px-1">
        <button
          type="button"
          onClick={() => dispatch(toggleTopic("__agents__"))}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-md text-left text-[10px] font-semibold uppercase tracking-wider text-base-content/45 transition hover:text-base-content"
          aria-expanded={!collapsed}
        >
          <ChevronDown
            size={12}
            className={`shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <Tooltip text={t("agents.tooltip")}>
            <span className="truncate">{t("agents.section_title")}</span>
          </Tooltip>
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

      {collapsed ? null : agents.length === 0 ? (
        <p className="px-1 py-1 text-[10px] text-base-content/50">
          {t("agents.empty")}
        </p>
      ) : (
        <div className="space-y-0.5">
          {agents.map((agent) => {
            const active = agent.id === activeId;
            return (
              <div
                key={agent.id}
                className={`group relative flex min-h-[16px] items-center rounded-xl px-2 py-1 ${
                  active
                    ? "bg-base-200 text-base-content shadow-sm"
                    : "text-base-content transition-all duration-100 hover:bg-base-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/agent/${agent.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title={agent.serverUrl}
                >
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
                  onClick={(event) => {
                    event.stopPropagation();
                    void remove(agent);
                  }}
                  disabled={removing === agent.id}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-base-content/40 transition hover:bg-error/10 hover:text-error group-hover:opacity-100 ${
                    removing === agent.id ? "opacity-100" : "opacity-0"
                  }`}
                  title={t("agents.remove")}
                  aria-label={t("agents.remove")}
                >
                  {removing === agent.id ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <TrashCan size={13} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
