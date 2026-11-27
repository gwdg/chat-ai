// The SAIA filesystem (saia-fs), reached through the engine's
// `<backend>/mcp/saia-fs` path.
//
// saia-fs is an MCP server (streamable HTTP at `/mcp`) behind the SAIA
// registry. The engine owns the hop: its `/v1/mcp/<service>` route forwards the
// whole exchange to the registered service and passes the caller's identity
// header through, so the browser only knows `backendPath` and there is nothing
// else to configure.
//
// The service is not a chat model, so `/v1/models` cannot say whether a
// deployment offers it. Availability is a real probe: `<base>/health` answers
// `{"status":"alive"}` while the instance is running, and 404 (no route), 503
// (no instance) or a connection error otherwise. Everything except that
// confirmed answer counts as unavailable, because the workspace source must
// appear only while the service actually is.
import { agentEndpoint } from "./agentEndpoints";
import { authHeaders } from "./authHeaders";

const trimSlashes = (url) => url.replace(/\/+$/, "");

/**
 * The base URL the browser uses for saia-fs: the deployment's
 * `<backend>/mcp/saia-fs` path, derived from `backendPath` like every other app
 * request.
 */
export const saiaFsBaseUrl = () => `${trimSlashes(agentEndpoint())}/mcp/saia-fs`;

/** The MCP endpoint of the service, as `SaiaFsProvider` expects it. */
export const saiaFsMcpUrl = () => `${saiaFsBaseUrl()}/mcp`;

/** The liveness answer for the service. */
export const saiaFsHealthUrl = () => `${saiaFsBaseUrl()}/health`;

/**
 * How long the availability probe waits before it calls the service absent.
 *
 * Same hop as the saia-rag probe and the same reason for the length: the
 * registry can spend exact multiples of its 5 s connect timeout on an
 * instance's tunnels before the request reaches a service whose handler answers
 * in microseconds (measured 11.9-15.0 s for saia-rag on the local stack), so a
 * shorter deadline reports a healthy service as unavailable. No instance
 * registered is answered 404/503 immediately, so this only bounds a stall.
 */
export const SAIA_FS_HEALTH_TIMEOUT_MS = 20000;

/**
 * Ask whether this deployment can serve saia-fs to the current user.
 *
 * The probe never throws: a refused request, an aborted one (timeout or an
 * unmounted caller) and a non-`alive` answer all mean "not available", which is
 * the fail-closed result the source list needs.
 *
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [options]
 * @returns {Promise<boolean>}
 */
export async function isSaiaFsAvailable({
  signal,
  timeoutMs = SAIA_FS_HEALTH_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  }
  try {
    const response = await fetch(saiaFsHealthUrl(), {
      method: "GET",
      headers: authHeaders(),
      signal: controller.signal,
      // A probe must not be answered by a cached success from an earlier start.
      cache: "no-store",
    });
    if (!response.ok) return false;
    const body = await response.json().catch(() => null);
    return body?.status === "alive";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", abort);
  }
}
