import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";
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
import {
  addAgent,
  removeAgent,
  useAgents,
} from "../../agents/agentStore";
import {
  selectCollapsedTopics,
  toggleTopic,
} from "../../Redux/reducers/interfaceSettingsSlice";

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
export default function AgentList() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal } = useModal();
  const { notifyError } = useToast();
  const agents = useAgents();
  const [removing, setRemoving] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<
    Record<string, "ready" | "working" | "error" | "checking">
  >({});
  const statusPollingRef = useRef(false);
  const collapsedTopicIds = useSelector(selectCollapsedTopics) ?? [];
  const collapsed = collapsedTopicIds.includes("__agents__");
  const activeId = location.pathname.startsWith("/agent/")
    ? location.pathname.slice("/agent/".length)
    : null;

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (statusPollingRef.current || document.visibilityState === "hidden") {
        return;
      }
      statusPollingRef.current = true;
      try {
        const next: Record<
          string,
          "ready" | "working" | "error" | "checking"
        > = {};
        await Promise.all(
          agents.map(async (agent) => {
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
        if (!cancelled) setStatuses(next);
      } finally {
        statusPollingRef.current = false;
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
  }, [agents]);

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
                {removing === agent.id ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <span className="loading loading-spinner loading-xs" />
                  </span>
                ) : (
                  <Popover className="relative shrink-0">
                    <PopoverButton
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
            );
          })}
        </div>
      )}
    </div>
  );
}
