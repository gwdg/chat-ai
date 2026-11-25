import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import {
  AGENT_SERVICE_CONFLICT_EVENT,
  deleteServiceAgent,
} from "../../apis/agentService";
import { getAgents, removeAgent } from "../../agents/agentStore";
import { useToast } from "../../hooks/useToast";

// An open agent page starts several requests at once, so one dead agent answers
// 409 more than once. Remove it once, not once per request.
const removed = new Set();

/**
 * Drop service-managed agents that the agent service refuses to run.
 *
 * A 409 `conflict` means the service will not serve that row (failed,
 * terminated, …), and this client has no lifecycle control that could repair it.
 * Keeping the agent only repeats the same error on every poll, so the user is
 * told why, the local entry is removed and the service-side agent is deleted
 * (which also frees its process).
 */
const AgentConflictWatcher = () => {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const onConflict = (event) => {
      const { serviceAgentId, status } = event?.detail ?? {};
      if (!serviceAgentId || removed.has(serviceAgentId)) return;
      // A transition ends on its own; deleting a healthy agent would be worse
      // than the error the caller already reports.
      if (status === "starting" || status === "stopping") return;

      removed.add(serviceAgentId);
      const agent = getAgents().find(
        (row) => row.serviceAgentId === serviceAgentId,
      );
      if (agent) {
        removeAgent(agent.id);
        if (pathname === `/agent/${agent.id}`) navigate("/chat");
      }
      notifyError(
        t("agents.service_conflict_removed", {
          name: agent?.name || serviceAgentId,
          status: status || t("agents.service_conflict_unknown"),
        }),
        { autoClose: 8000 },
      );
      // The local entry is gone either way; the service call is what stops the
      // process, so it must not hold up the UI.
      void deleteServiceAgent(serviceAgentId).catch(() => {});
    };

    window.addEventListener(AGENT_SERVICE_CONFLICT_EVENT, onConflict);
    return () =>
      window.removeEventListener(AGENT_SERVICE_CONFLICT_EVENT, onConflict);
  }, [navigate, notifyError, pathname, t]);

  return null;
};

export default AgentConflictWatcher;
