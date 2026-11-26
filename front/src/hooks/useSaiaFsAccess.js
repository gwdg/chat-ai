// Whether this deployment offers the SAIA filesystem to the current user.
//
// saia-fs used to be registered as a model in an access group, so `/v1/models`
// was the availability answer. It is no longer a model (`apis/serviceModels`),
// and the question is now asked of the service itself: the deployment forwards
// `/mcp/saia-fs/health` to the registry, which answers `{"status":"alive"}` only
// while an instance is registered.
//
// Three states, and only `available` provisions a source:
// - `checking`    the probe has not answered yet,
// - `available`   the service confirmed that it is alive,
// - `unavailable` anything else: no route, no instance, a timeout or a network
//                 failure. This fails closed on purpose — the source is shown
//                 only when the service is actually there.
import { useEffect, useState } from "react";

import { isSaiaFsAvailable } from "../apis/saiaFs";

export const SAIA_FS_CHECKING = "checking";
export const SAIA_FS_AVAILABLE = "available";
export const SAIA_FS_UNAVAILABLE = "unavailable";

/** @returns {"checking" | "available" | "unavailable"} */
export function useSaiaFsAccess() {
  const [access, setAccess] = useState(SAIA_FS_CHECKING);

  useEffect(() => {
    const controller = new AbortController();
    void isSaiaFsAvailable({ signal: controller.signal }).then((available) => {
      if (controller.signal.aborted) return;
      setAccess(available ? SAIA_FS_AVAILABLE : SAIA_FS_UNAVAILABLE);
    });
    return () => controller.abort();
  }, []);

  return access;
}
