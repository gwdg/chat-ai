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
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { isSaiaRagAvailable } from "../apis/saiaRag";

export const SAIA_RAG_CHECKING = "checking";
export const SAIA_RAG_AVAILABLE = "available";
export const SAIA_RAG_UNAVAILABLE = "unavailable";

export type SaiaRagAccess =
  | typeof SAIA_RAG_CHECKING
  | typeof SAIA_RAG_AVAILABLE
  | typeof SAIA_RAG_UNAVAILABLE;

/**
 * How long a confirmed answer stands in for a new probe.
 *
 * The probe is not free: it crosses the engine's hop into the SAIA registry,
 * and that hop occasionally answers in seconds instead of milliseconds (a
 * restarting instance, or one the registry still lists after it went away).
 * Every page mounts its own sidebar, so a probe per mount meant a fresh
 * multi-second request on each navigation, and the Arcanas page waited for it
 * before it even started its MCP handshake.
 *
 * One answer is therefore shared: the first surface asks, the rest read it, and
 * a successful result keeps for a minute. A *failed* probe is not kept — a
 * service that just started must be found by the next mount or the Reload
 * button — so `unavailable` is only shared while the request is in flight.
 */
export const SAIA_RAG_ACCESS_TTL_MS = 60_000;

let status: SaiaRagAccess = SAIA_RAG_CHECKING;
let confirmedAt = 0;
/**
 * Answers an older probe after a newer one started must not win.
 *
 * `reload()` starts a fresh request while an older one may still be running;
 * adopting that one would paint the state the user just asked to re-check.
 */
let generation = 0;
let inflight: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

const announce = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => status;

function startProbe(): Promise<boolean> {
  const attempt = ++generation;
  status = SAIA_RAG_CHECKING;
  announce();
  const request = isSaiaRagAvailable()
    .then((available) => {
      if (attempt === generation) {
        status = available ? SAIA_RAG_AVAILABLE : SAIA_RAG_UNAVAILABLE;
        // A confirmed service is worth reusing; a failure is re-asked.
        confirmedAt = available ? Date.now() : 0;
      }
      return available;
    })
    .finally(() => {
      if (inflight === request) inflight = null;
      announce();
    });
  inflight = request;
  return request;
}

/** Ask once per mounted surface, reusing an answer that is still good. */
function ensureProbe(): void {
  if (inflight) return;
  if (
    status === SAIA_RAG_AVAILABLE &&
    Date.now() - confirmedAt < SAIA_RAG_ACCESS_TTL_MS
  ) {
    return;
  }
  void startProbe();
}

/**
 * The probe's answer plus a way to ask it again.
 *
 * A surface that reports "not connected" has to offer a reload: the service may
 * have started after the page loaded, and a full browser reload is the wrong
 * answer to a five-second probe. Asking again returns to `checking` while the
 * new attempt runs, so the button cannot be clicked twice for one answer, and
 * every mounted surface follows the same state instead of each keeping its own.
 *
 * The probe is deliberately not tied to a mount's lifetime: leaving a page in
 * the middle of a slow answer would otherwise throw away the only copy of it,
 * and the next page would pay the same seconds again.
 *
 * @returns {{ access: SaiaRagAccess, reload: () => void }}
 */
export function useSaiaRagAccessWithReload() {
  const access = useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    ensureProbe();
  }, []);

  const reload = useCallback(() => {
    confirmedAt = 0;
    void startProbe();
  }, []);

  return { access, reload };
}

/**
 * The status alone, for a caller that has no reload control.
 *
 * @returns {SaiaRagAccess}
 */
export function useSaiaRagAccess() {
  return useSaiaRagAccessWithReload().access;
}

/**
 * Drop the shared answer between tests.
 *
 * The state is module-level on purpose (that is what makes it shared), so a
 * test file that mounts several surfaces has to start from "nothing known".
 */
export function resetSaiaRagAccessForTests(): void {
  generation += 1;
  status = SAIA_RAG_CHECKING;
  confirmedAt = 0;
  inflight = null;
  announce();
}
