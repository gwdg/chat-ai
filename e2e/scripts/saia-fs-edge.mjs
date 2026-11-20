// Deployment edge for the opt-in saia-fs scenario.
//
// Chat AI reaches the SAIA filesystem at `<backendPath>/saia-fs`, which the
// deployment in front of it has to forward to the registry's
// `/services/saia-fs/<path>` and stamp with the caller's identity. Neither
// `back` nor the engine does that (`AGENTS.md` §4.31), so a local stack has no
// such hop at all. This script is that hop for the test: it forwards the MCP
// exchange unchanged, adds `x-auth-claim-uid` from the same `oidc_claim_uid`
// header `back` maps, and answers the CORS preflight a browser needs.
//
// It is a test double, not a deployment component. Started by
// `playwright.config.ts` when `E2E_SAIA_FS_EDGE=harness`; with `E2E_SAIA_FS=1`
// alone the scenario talks to a bare saia-fs instance (`E2E_SAIA_FS_URL`, default
// `http://127.0.0.1:8003`) through the config's `saiaFsEndpoint`.
import { createServer } from "node:http";

const PORT = Number(process.env.E2E_SAIA_FS_EDGE_PORT ?? 4102);
const REGISTRY = (process.env.E2E_SAIA_FS_REGISTRY ?? "http://127.0.0.1:5000").replace(/\/+$/, "");
const DEFAULT_USER = process.env.E2E_SAIA_FS_USER ?? "tester";
const ORIGIN = process.env.E2E_SAIA_FS_ORIGIN ?? "*";

const MCP_HEADERS = ["accept", "content-type", "mcp-session-id", "mcp-protocol-version"];
const EXPOSED = ["mcp-session-id", "mcp-protocol-version"];

const header = (headers, name) => {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
};

const corsHeaders = (req) => ({
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": header(req.headers, "access-control-request-headers") ?? "*",
  "access-control-expose-headers": EXPOSED.join(", "),
});

const server = createServer(async (req, res) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  if (req.url === "/__edge/health") {
    res.writeHead(200, { ...cors, "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", registry: REGISTRY }));
    return;
  }

  const [pathname, query = ""] = (req.url ?? "/").split("?");
  const match = /^\/saia-fs(\/.*)?$/.exec(pathname);
  if (!match) {
    res.writeHead(404, { ...cors, "content-type": "application/json" });
    res.end(JSON.stringify({ error: `the test edge only serves /saia-fs, not ${pathname}` }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  const headers = {};
  for (const name of MCP_HEADERS) {
    const value = header(req.headers, name);
    if (value) headers[name] = value;
  }
  // What the authenticating hop adds in a deployment: the caller's identity for
  // saia-fs's `--mode saia`, taken from the claim the browser sends.
  headers["x-auth-claim-uid"] =
    header(req.headers, "oidc_claim_uid") ??
    header(req.headers, "x-auth-claim-uid") ??
    header(req.headers, "inference-id") ??
    DEFAULT_USER;

  const target = `${REGISTRY}/services/saia-fs${match[1] || "/mcp"}${query ? `?${query}` : ""}`;
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    });
    const responseHeaders = { ...cors };
    for (const name of ["content-type", "cache-control", ...EXPOSED]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders[name] = value;
    }
    res.writeHead(upstream.status, responseHeaders);
    console.log(`[saia-fs edge] ${req.method} ${pathname} -> ${upstream.status} (uid ${headers["x-auth-claim-uid"]})`);
    if (!upstream.body) {
      res.end();
      return;
    }
    // Streamed, because an MCP tool result arrives as server-sent events.
    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    console.error(`[saia-fs edge] ${req.method} ${pathname} -> ${target} failed:`, error);
    res.writeHead(502, { ...cors, "content-type": "text/plain" });
    res.end(`the test edge could not reach ${target}: ${error instanceof Error ? error.message : error}`);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[saia-fs edge] http://127.0.0.1:${PORT}/saia-fs -> ${REGISTRY}/services/saia-fs`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
