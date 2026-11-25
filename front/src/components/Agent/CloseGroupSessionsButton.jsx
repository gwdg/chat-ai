import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TrashCan } from "@carbon/icons-react";

import { closeAgentSessions } from "../../agents/agentSessions";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";

/**
 * Closes every session of one agent inside one sidebar group (a workspace or "Not in a
 * workspace"). Running turns are interrupted before the sessions are deleted, and the action
 * always needs an explicit confirmation in a modal — it can never be silenced with
 * "don't show this again".
 */
export default function CloseGroupSessionsButton({
  agent,
  sessionIds = [],
  groupName,
  className = "",
}) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { notifySuccess, notifyError } = useToast();
  const [closing, setClosing] = useState(false);
  const ids = Array.from(sessionIds ?? []).filter(Boolean);
  if (!ids.length) return null;

  const label = t("agents.close_group_sessions");

  const confirmCloseAll = () =>
    openModal("confirmAction", {
      messageKey: "alert.close_agent_group_sessions",
      messageValues: { count: ids.length, group: groupName },
      confirmKey: "alert.close_agent_group_sessions_yes",
      showDontShowAgain: false,
      danger: true,
      onConfirm: async () => {
        setClosing(true);
        try {
          const result = await closeAgentSessions(
            agent,
            ids.map((id) => ({ id })),
          );
          if (result.closed.length) {
            notifySuccess(
              t("agents.group_sessions_closed", {
                count: result.closed.length,
              }),
            );
          }
          if (result.failed.length) {
            notifyError(
              t("agents.group_sessions_failed", {
                count: result.failed.length,
                message: String(
                  result.failed[0]?.reason?.message ??
                    result.failed[0]?.reason,
                ),
              }),
            );
          }
        } catch (reason) {
          notifyError(reason instanceof Error ? reason.message : String(reason));
        } finally {
          setClosing(false);
        }
      },
    });

  return (
    <button
      type="button"
      onClick={confirmCloseAll}
      disabled={closing}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-base-content/40 transition hover:bg-base-300 hover:text-error disabled:opacity-50 ${className}`}
      title={label}
      aria-label={label}
      data-guide="close-group-sessions"
      data-testid="close-group-sessions"
    >
      {closing ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <TrashCan size={11} />
      )}
    </button>
  );
}
