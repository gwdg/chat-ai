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
} from "@carbon/icons-react";
import { GitBranch } from "lucide-react";

import {
  deleteAgentSession,
  sessionLabel,
} from "../../agents/agentSessions";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";

const SessionRow = ({
  session,
  depth,
  active,
  onSelect,
  onRename,
  onClose,
  subLabel,
}) => {
  const { t } = useTranslation();
  const Icon = depth > 0 ? GitBranch : Bot;
  return (
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
        title={session.id}
      >
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
};

export default function AgentSessionList({
  agent,
  tree,
  activeSessionId,
  onSelect,
  onCreate,
  creating = false,
  showCreate = true,
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
        onSelect={onSelect}
        onRename={renameSession}
        onClose={closeSession}
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
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-base-content/45">
          {t("agents.sessions")}
          {tree?.all?.length ? ` (${tree.all.length})` : ""}
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
      <div className="max-h-56 space-y-0.5 overflow-y-auto">
        {roots.length === 0 && (
          <p className="px-2 py-1 text-[10px] text-base-content/45">
            {t("agents.no_sessions")}
          </p>
        )}
        {roots.map((session) => renderSession(session))}
      </div>
    </div>
  );
}
