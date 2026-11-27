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
import { useCallback, useEffect, useState } from "react";

import { isSaiaRagAvailable } from "../apis/saiaRag";

export const SAIA_RAG_CHECKING = "checking";
export const SAIA_RAG_AVAILABLE = "available";
export const SAIA_RAG_UNAVAILABLE = "unavailable";

/**
 * One re-probe reaches every surface that asked.
 *
 * The sidebar and the Arcanas page each run their own probe, and both show the
 * service's state. Reloading in one of them must not leave the other saying
 * "not connected" beside a working list, so the request is announced instead of
 * handled locally.
 */
const RELOAD_EVENT = "chatai:saia-rag-access-reload";

/**
 * The probe's answer plus a way to ask it again.
 *
 * A surface that reports "not connected" has to offer a reload: the service may
 * have started after the page loaded, and a full browser reload is the wrong
 * answer to a five-second probe. Asking again returns to `checking` while the
 * new attempt runs, so the button cannot be clicked twice for one answer.
 *
 * @returns {{ access: "checking" | "available" | "unavailable", reload: () => void }}
 */
export function useSaiaRagAccessWithReload() {
  const [access, setAccess] = useState(SAIA_RAG_CHECKING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void isSaiaRagAvailable({ signal: controller.signal }).then((available) => {
      if (controller.signal.aborted) return;
      setAccess(available ? SAIA_RAG_AVAILABLE : SAIA_RAG_UNAVAILABLE);
    });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const restart = () => {
      setAccess(SAIA_RAG_CHECKING);
      setAttempt((value) => value + 1);
    };
    window.addEventListener(RELOAD_EVENT, restart);
    return () => window.removeEventListener(RELOAD_EVENT, restart);
  }, []);

  const reload = useCallback(() => {
    window.dispatchEvent(new Event(RELOAD_EVENT));
  }, []);

  return { access, reload };
}

/**
 * The status alone, for a caller that has no reload control.
 *
 * @returns {"checking" | "available" | "unavailable"}
 */
export function useSaiaRagAccess() {
  return useSaiaRagAccessWithReload().access;
}
