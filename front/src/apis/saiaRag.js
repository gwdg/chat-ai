// saia-rag, the SAIA document collections service, reached through the engine's
// `<backend>/mcp/saia-rag` path.
//
// saia-rag is an MCP server (streamable HTTP at `/mcp`) behind the SAIA
// registry. The engine owns the hop: its generic `/v1/mcp/<service>` route
// forwards the whole exchange to the registered service and passes the caller's
// identity header through, so the browser only knows `backendPath` and there is
// nothing else to configure.
//
// The service is not a chat model, so `/v1/models` cannot say whether a
// deployment offers it. Availability is a real probe: `<base>/health` answers
// `{"status":"alive"}` while an instance is registered, and everything else
// (404, 503, a timeout, a refused connection) counts as unavailable. The
// workspace source must appear only while the service actually is there.
import { agentEndpoint } from "./agentEndpoints";
import { authHeaders } from "./authHeaders";

const trimSlashes = (url) => url.replace(/\/+$/, "");

/**
 * The base URL the browser uses for saia-rag: the deployment's
 * `<backend>/mcp/saia-rag` path, derived from `backendPath` like every other app
 * request. The engine answers it (and answers 404 when the service is not
 * registered, which the probe treats as absent).
 */
export const saiaRagBaseUrl = () => `${trimSlashes(agentEndpoint())}/mcp/saia-rag`;

/** The MCP endpoint of the service. */
export const saiaRagMcpUrl = () => `${saiaRagBaseUrl()}/mcp`;

/** The liveness answer for the service. */
export const saiaRagHealthUrl = () => `${saiaRagBaseUrl()}/health`;

/**
 * How long the availability probe waits before it calls the service absent.
 *
 * It has to outlast the engine's hop, not just the service: `/health` is served
 * in microseconds, but the hop into the SAIA registry sometimes waits on the
 * instance's tunnels and answers in exact multiples of the registry's 5 s
 * connect timeout (measured 11.9, 15.0 and 15.0 s on the local stack, with the
 * service healthy throughout). A shorter deadline therefore reported a working
 * service as unavailable. An absent service is not the slow case: the registry
 * answers 404/503 immediately when no instance is registered, so this deadline
 * only ever bounds a stall.
 */
export const SAIA_RAG_HEALTH_TIMEOUT_MS = 20000;

/**
 * Ask whether this deployment can serve saia-rag to the current user.
 *
 * The probe never throws: a refused request, an aborted one and a non-`alive`
 * answer all mean "not available", which is the fail-closed result the source
 * list needs.
 *
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [options]
 * @returns {Promise<boolean>}
 */
export async function isSaiaRagAvailable({
  signal,
  timeoutMs = SAIA_RAG_HEALTH_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  }
  try {
    const response = await fetch(saiaRagHealthUrl(), {
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

/**
 * A connected MCP client for saia-rag.
 *
 * The caller's headers go along, so the deployment's proxy sees the request as
 * the same user; the service itself is never called directly. Each caller owns
 * the returned client and closes it (`client.close()`), except the workspace
 * provider, which keeps one for the life of the source.
 *
 * `url` is the provider's own endpoint when it was constructed for one; the
 * workspace sources use the deployment default.
 */
export async function openSaiaRagClient(url = saiaRagMcpUrl()) {
  const [{ Client }, transportModule] = await Promise.all([
    import("@modelcontextprotocol/sdk/client/index.js"),
    import("@modelcontextprotocol/sdk/client/streamableHttp.js"),
  ]);
  const client = new Client({ name: "chat-ai-workspace", version: "1.0.0" });
  const transport = new transportModule.StreamableHTTPClientTransport(
    new URL(url),
    { requestInit: { headers: authHeaders() } },
  );
  await client.connect(transport);
  return client;
}

/** The text of an MCP tool result, and its error flag. */
export function readToolResult(result) {
  const content = result?.content;
  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    text = content
      .map((part) => (part?.type === "text" ? String(part.text ?? "") : ""))
      .join("");
  } else if (content != null) {
    text = String(content);
  }
  return { text, isError: result?.isError === true };
}

/** Close a client without letting a dead transport throw on teardown. */
export function closeQuietly(client) {
  try {
    client?.close?.();
  } catch {
    // A transport that is already gone must not throw.
  }
}
