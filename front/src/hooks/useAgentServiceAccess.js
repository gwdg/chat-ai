// Whether the current user may use the GWDG HPC agentic service.
//
// The service is registered in the SAIA engine as the model `saia-agent`, inside
// an access group, and the engine lists a model only for the users who were
// granted its group. The deployment's model list is therefore the entitlement
// answer: without `saia-agent` the service cannot start an agent for this user
// at all, so the add-agent dialog has to disable its service fields instead of
// failing after the click.
//
// Four states, because "could not read the list" is not the answer "no":
// - `checking`  the list has not arrived yet,
// - `granted`   the list contains the model,
// - `denied`    the list is readable and does not contain the model,
// - `unknown`   the list is empty or the models endpoint refused, so access is
//               not knowable here and the dialog must not claim it is missing.
import { useEffect, useState } from "react";

import { AGENT_SERVICE_MODEL } from "../apis/agentService";
import { getModelsData } from "../apis/getModelsData";

export const AGENT_SERVICE_CHECKING = "checking";
export const AGENT_SERVICE_GRANTED = "granted";
export const AGENT_SERVICE_DENIED = "denied";
export const AGENT_SERVICE_UNKNOWN = "unknown";

/** @returns {"checking" | "granted" | "denied" | "unknown"} */
export function useAgentServiceAccess() {
  const [access, setAccess] = useState(AGENT_SERVICE_CHECKING);

  useEffect(() => {
    let cancelled = false;
    getModelsData()
      .then((models) => {
        if (cancelled) return;
        // `getModelsData` answers with a `Response` when the endpoint refuses and
        // with an empty array when it fails entirely. Neither says anything about
        // this user's grants.
        if (!Array.isArray(models) || models.length === 0) {
          setAccess(AGENT_SERVICE_UNKNOWN);
          return;
        }
        const granted = models.some(
          (model) => model?.id === AGENT_SERVICE_MODEL,
        );
        setAccess(granted ? AGENT_SERVICE_GRANTED : AGENT_SERVICE_DENIED);
      })
      // A failed read is not a refusal either, and a rejected promise would
      // otherwise leave the dialog stuck on `checking` forever.
      .catch(() => {
        if (!cancelled) setAccess(AGENT_SERVICE_UNKNOWN);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return access;
}
