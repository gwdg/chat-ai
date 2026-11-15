import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";
import {
  Add,
  Bot,
  Edit,
  OverflowMenuVertical,
  TrashCan,
  Unlink,
} from "@carbon/icons-react";
import { CloudOff, GitBranch } from "lucide-react";

import {
  deleteAgentSession,
  sessionLabel,
} from "../../agents/agentSessions";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";
import Tooltip from "../Others/Tooltip";
import ShortcutTooltip from "../Sidebar/ShortcutTooltip";

const SessionRow = ({
  session,
  depth,
  active,
  status,
  summary,
  onSelect,
  onRename,
  onClose,
  onDetach,
  subLabel,
}) => {
  const { t } = useTranslation();
  const Icon = depth > 0 ? GitBranch : Bot;
  const statusClass =
    status === "working"
      ? "bg-warning animate-pulse"
      : status === "error"
        ? "bg-error"
        : status === "ready"
          ? "bg-success"
          : "bg-base-content/20";
  const row = (
    <div
      className={`group flex items-center rounded-md pr-1 transition ${
        active
          ? "bg-base-200 text-base-content"
          : "text-base-content/75 hover:bg-base-200"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect?.(session)}
        className={`flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-[11px] ${
          active ? "font-medium" : ""
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        title={summary || undefined}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusClass}`}
          title={t(`agents.status_${status || "checking"}`)}
          aria-label={t(`agents.status_${status || "checking"}`)}
        />
        <Icon size={11} className="shrink-0 text-base-content/45" />
        <span className="min-w-0 flex-1 truncate">{sessionLabel(session)}</span>
        {depth > 0 && (
          <span className="shrink-0 rounded bg-base-300 px-1 text-[9px] text-base-content/60">
            {subLabel}
          </span>
        )}
      </button>
      <Popover className="relative shrink-0">
        <PopoverButton
          className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-base-300 hover:text-base-content focus:opacity-100 group-hover:opacity-100"
          title={t("agents.session_options")}
          aria-label={t("agents.session_options")}
        >
          <OverflowMenuVertical size={14} />
        </PopoverButton>
        <PopoverPanel
          anchor="bottom end"
          className="z-50 w-40 rounded-xl border border-base-300 bg-base-100 p-1 shadow-lg"
        >
          {({ close }) => (
            <>
              {onDetach && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onDetach(session);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/80 transition hover:bg-base-200"
                >
                  <Unlink size={13} />
                  {t("agents.detach_session")}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  close();
                  onRename?.(session);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/80 transition hover:bg-base-200"
              >
                <Edit size={13} />
                {t("agents.rename_session")}
              </button>
              <button
                type="button"
                onClick={() => {
                  close();
                  onClose?.(session);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-error transition hover:bg-error/10"
              >
                <TrashCan size={13} />
                {t("agents.close_session")}
              </button>
            </>
          )}
        </PopoverPanel>
      </Popover>
    </div>
  );
  if (!summary) return row;
  return (
    <ShortcutTooltip
      label={summary}
      position="right"
      enterDelay={350}
      multiline
      containerClassName="block"
    >
      {row}
    </ShortcutTooltip>
  );
};

export default function AgentSessionList({
  agent,
  tree,
  activeSessionId,
  statuses = {},
  summaries = {},
  onSelect,
  onCreate = undefined,
  onDetach = undefined,
  creating = false,
  showCreate = true,
  showHeader = true,
  emptyKey = "agents.no_sessions",
  className = "",
}) {
  const { t } = useTranslation();
  const { openModal, confirmAction } = useModal();
  const { notifySuccess, notifyError } = useToast();
  const subLabel = t("agents.subagent_short");
  const roots = tree?.roots ?? [];
  const children = tree?.children ?? new Map();

  const renameSession = (session) => {
    openModal("agentSessionRename", { agent, session });
  };

  const renderSession = (session, depth = 0) => (
    <div key={session.id}>
      <SessionRow
        session={session}
        depth={depth}
        active={activeSessionId === session.id}
        status={statuses[session.id]}
        summary={summaries[session.id]?.summary}
        onSelect={onSelect}
        onRename={renameSession}
        onClose={closeSession}
        onDetach={onDetach}
        subLabel={subLabel}
      />
      {(children.get(session.id) || []).map((child) =>
        renderSession(child, depth + 1),
      )}
    </div>
  );

  const closeSession = (session) => {
    confirmAction(
      {
        warningKey: "warn_close_chat",
        messageKey: "alert.close_agent_session",
        confirmKey: "alert.close_agent_session_yes",
        danger: true,
      },
      async () => {
        try {
          await deleteAgentSession(agent, session, tree);
          notifySuccess(t("agents.session_closed"));
        } catch (reason) {
          notifyError(reason instanceof Error ? reason.message : String(reason));
        }
      },
    );
  };

  return (
    <div
      className={`rounded-lg border border-base-300/70 bg-base-100/40 p-1 ${className}`}
      data-guide="agent-session-list"
    >
      {showHeader && (
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="flex min-w-0 items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wide text-base-content/45">
            <span className="truncate">
              {t("agents.sessions")}
              {tree?.all?.length ? ` (${tree.all.length})` : ""}
            </span>
            {tree?.offline && (
              <Tooltip text={t("agents.sessions_cached")}>
                <span
                  className="flex shrink-0 items-center gap-1 font-normal normal-case tracking-normal text-warning"
                  data-testid="agent-sessions-cached"
                >
                  <CloudOff size={11} />
                  {t("agents.sessions_cached_short")}
                </span>
              </Tooltip>
            )}
          </span>
          {showCreate && (
            <button
              type="button"
              onClick={() => onCreate?.(agent)}
              disabled={creating}
              className="flex h-5 w-5 items-center justify-center rounded text-base-content/50 hover:bg-base-200 hover:text-base-content disabled:opacity-50"
              title={t("agents.new_session")}
              aria-label={t("agents.new_session")}
            >
              {creating ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Add size={13} />
              )}
            </button>
          )}
        </div>
      )}
      <div className="max-h-56 space-y-0.5 overflow-y-auto">
        {roots.length === 0 && (
          <p className="px-2 py-1 text-[10px] text-base-content/45">
            {t(emptyKey)}
          </p>
        )}
        {roots.map((session) => renderSession(session))}
      </div>
    </div>
  );
}
