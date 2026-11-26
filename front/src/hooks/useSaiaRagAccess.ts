// Whether this deployment offers saia-rag to the current user.
//
// The service is not a chat model, so `/v1/models` cannot answer it. The
// question is asked of the service itself: `<base>/health` answers
// `{"status":"alive"}` only while an instance is registered.
//
// Three states, and only `available` provisions a source:
// - `checking`    the probe has not answered yet,
// - `available`   the service confirmed that it is alive,
// - `unavailable` anything else: no route, no instance, a timeout or a network
//                 failure. This fails closed on purpose — the source is shown
//                 only when the service is actually there.
import { useEffect, useState } from "react";

import { isSaiaRagAvailable } from "../apis/saiaRag";

export const SAIA_RAG_CHECKING = "checking";
export const SAIA_RAG_AVAILABLE = "available";
export const SAIA_RAG_UNAVAILABLE = "unavailable";

/** @returns {"checking" | "available" | "unavailable"} */
export function useSaiaRagAccess() {
  const [access, setAccess] = useState(SAIA_RAG_CHECKING);

  useEffect(() => {
    const controller = new AbortController();
    void isSaiaRagAvailable({ signal: controller.signal }).then((available) => {
      if (controller.signal.aborted) return;
      setAccess(available ? SAIA_RAG_AVAILABLE : SAIA_RAG_UNAVAILABLE);
    });
    return () => controller.abort();
  }, []);

  return access;
}
