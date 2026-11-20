// Whether this deployment offers the SAIA filesystem to the current user.
//
// `saia-fs` registers itself in the SAIA engine as a service inside an access
// group, so the engine lists it in `/v1/models` only for the users who were
// granted it. That list is the availability answer — asking the source itself
// would only tell us that the row cannot connect.
//
// Four states, and only `granted` provisions a source:
// - `checking` the list has not arrived yet,
// - `granted`  the list contains `saia-fs`,
// - `denied`   the list is readable and does not contain it,
// - `unknown`  the endpoint refused or answered nothing. Unlike the agent
//              service this fails closed: the requirement is that the source is
//              shown only when the service is available, and an unreadable list
//              cannot say that it is.
import { useEffect, useState } from "react";

import { getModelsData } from "../apis/getModelsData";
import { SAIA_FS_SERVICE_MODEL } from "../apis/serviceModels";

export { SAIA_FS_SERVICE_MODEL };

export const SAIA_FS_CHECKING = "checking";
export const SAIA_FS_GRANTED = "granted";
export const SAIA_FS_DENIED = "denied";
export const SAIA_FS_UNKNOWN = "unknown";

/** @returns {"checking" | "granted" | "denied" | "unknown"} */
export function useSaiaFsAccess() {
  const [access, setAccess] = useState(SAIA_FS_CHECKING);

  useEffect(() => {
    let cancelled = false;
    getModelsData()
      .then((models) => {
        if (cancelled) return;
        // `getModelsData` answers with a `Response` when the endpoint refuses and
        // with an empty array when it fails entirely.
        if (!Array.isArray(models) || models.length === 0) {
          setAccess(SAIA_FS_UNKNOWN);
          return;
        }
        const listed = models.some(
          (model) => model?.id === SAIA_FS_SERVICE_MODEL,
        );
        setAccess(listed ? SAIA_FS_GRANTED : SAIA_FS_DENIED);
      })
      .catch(() => {
        if (!cancelled) setAccess(SAIA_FS_UNKNOWN);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return access;
}
