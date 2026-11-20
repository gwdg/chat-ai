// The SAIA filesystem (saia-fs), reached through `<backend>/saia-fs`.
//
// saia-fs is an MCP server that registers in the SAIA registry, and the
// registry's HTTP listener (:5000/services/saia-fs) is not published. The
// deployment's own `<backend>/saia-fs` path therefore forwards the MCP exchange
// to the registry and stamps the caller's identity; Chat AI only builds that URL
// from `backendPath`, so no config key can point the browser at the service
// itself.
//
// The service is not a chat model, so `/v1/models` cannot say whether a
// deployment offers it. Availability is a real probe: the registry answers
// `<base>/health` with `{"status":"alive"}` while an instance is registered,
// and with 404 (no route), 503 (no instance) or a connection error otherwise.
// Everything except that confirmed answer counts as unavailable, because the
// workspace source must appear only while the service actually is.
import { agentEndpoint } from "./agentEndpoints";
import { authHeaders } from "./authHeaders";

const trimSlashes = (url) => url.replace(/\/+$/, "");

/**
 * The base URL the browser uses for saia-fs: the deployment's `<backend>/saia-fs`
 * path, which forwards it to the registry service.
 */
export const saiaFsBaseUrl = () => `${trimSlashes(agentEndpoint())}/saia-fs`;

/** The MCP endpoint of the service, as `SaiaFsProvider` expects it. */
export const saiaFsMcpUrl = () => `${saiaFsBaseUrl()}/mcp`;

/** The registry's liveness answer for the service, through the deployment. */
export const saiaFsHealthUrl = () => `${saiaFsBaseUrl()}/health`;

/**
 * How long the availability probe waits before it calls the service absent.
 * The registry answers well inside this; a hanging instance must not keep the
 * source list waiting.
 */
export const SAIA_FS_HEALTH_TIMEOUT_MS = 5000;

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
