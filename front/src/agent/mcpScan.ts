// Looks for MCP servers running on this device. A server that speaks Streamable HTTP answers
// `/mcp`; the scan therefore probes every port above 5000 and keeps the ports where that path
// answers like an MCP endpoint. Nothing leaves the machine: every request goes to localhost.

/** The first port of the scan. Ports 1-5000 are skipped: they need privileges or host services. */
export const LOCAL_MCP_SCAN_FIRST_PORT = 5001;
/** The last port of the scan. */
export const LOCAL_MCP_SCAN_LAST_PORT = 65535;

const MCP_PATH = "/mcp";
// Probes run side by side; a connection refused fails immediately, so a modest number of
// workers already covers the whole range quickly without exhausting the browser.
const DEFAULT_CONCURRENCY = 64;
// A local server answers in a few milliseconds; anything slower is not worth waiting for.
const DEFAULT_TIMEOUT_MS = 750;

export interface LocalMcpServer {
  port: number;
  /** `http://<host>:<port>/mcp`, ready for the server list. */
  url: string;
}

export interface LocalMcpScanProgress {
  scanned: number;
  total: number;
  found: number;
}

export interface LocalMcpScanOptions {
  firstPort?: number;
  lastPort?: number;
  /** Defaults to `localhost`, which covers IPv4 and IPv6 on this machine. */
  host?: string;
  concurrency?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (progress: LocalMcpScanProgress) => void;
  /** Called as soon as a server is found, so the list can grow while the scan runs. */
  onFound?: (server: LocalMcpServer) => void;
  /** Lets tests replace the network call. */
  probe?: (port: number) => Promise<boolean>;
}

// A GET on the MCP endpoint of a Streamable HTTP server is answered with an SSE stream, a
// JSON-RPC error (`405` when only POST is served, `400` for a bad request) or an auth error.
// A `404` means the port has an HTTP server but no MCP endpoint there, and a 5xx is a broken
// server, not a usable one.
const MCP_ERROR_STATUS = new Set([400, 401, 403, 405, 406, 415]);
const MCP_CONTENT_TYPE = /(application|text)\/(json|event-stream|x-ndjson)/i;

/** Whether a response to `GET /mcp` looks like an MCP endpoint rather than an unrelated server. */
export function isMcpEndpointResponse(response: Response): boolean {
  if (response.status === 404 || response.status >= 500) return false;
  if (!response.ok && !MCP_ERROR_STATUS.has(response.status)) return false;
  if (response.headers.get("mcp-session-id")) return true;
  if (MCP_ERROR_STATUS.has(response.status)) return true;
  return MCP_CONTENT_TYPE.test(response.headers.get("content-type") ?? "");
}

async function probePort(
  port: number,
  host: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) return false;
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(`http://${host}:${port}${MCP_PATH}`, {
      method: "GET",
      headers: { Accept: "application/json, text/event-stream" },
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    return isMcpEndpointResponse(response);
  } catch {
    // Refused connection, timeout, CORS or mixed content: not a server we can use.
    return false;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    // A Streamable HTTP server answers GET with a long-lived SSE stream; the answer is
    // classified from its headers, so the body is not needed and the socket can close.
    controller.abort();
  }
}

/**
 * Probes every port in the range in parallel and returns the ones that answer `GET /mcp` like
 * an MCP endpoint, sorted by port. Aborting the signal stops the scan and keeps what was found.
 */
export async function scanLocalMcpServers(
  options: LocalMcpScanOptions = {},
): Promise<LocalMcpServer[]> {
  const host = options.host ?? "localhost";
  const first = Math.max(1, Math.trunc(options.firstPort ?? LOCAL_MCP_SCAN_FIRST_PORT));
  const last = Math.min(65535, Math.trunc(options.lastPort ?? LOCAL_MCP_SCAN_LAST_PORT));
  const total = Math.max(0, last - first + 1);
  if (!total) return [];
  const concurrency = Math.max(1, Math.trunc(options.concurrency ?? DEFAULT_CONCURRENCY));
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const probe =
    options.probe ?? ((port: number) => probePort(port, host, timeoutMs, options.signal));

  const found: LocalMcpServer[] = [];
  let scanned = 0;
  let next = first;
  const report = () =>
    options.onProgress?.({ scanned, total, found: found.length });

  report();
  const worker = async () => {
    while (!options.signal?.aborted) {
      const port = next;
      next += 1;
      if (port > last) return;
      let hit = false;
      try {
        hit = await probe(port);
      } catch {
        hit = false;
      }
      scanned += 1;
      if (hit) {
        const server = { port, url: `http://${host}:${port}${MCP_PATH}` };
        found.push(server);
        options.onFound?.(server);
        report();
      } else if (scanned % 25 === 0 || scanned === total) {
        report();
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => worker()),
  );
  report();
  return found.sort((left, right) => left.port - right.port);
}
