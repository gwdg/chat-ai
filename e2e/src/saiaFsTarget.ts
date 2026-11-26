/**
 * Where the opt-in saia-fs scenario points the app.
 *
 * Chat AI reaches the filesystem at `<backendPath>/mcp/saia-fs`: the engine's
 * generic MCP hop forwards the exchange to the SAIA registry and passes the
 * caller's identity through (`AGENTS.md` §4.31). A local stack has no such hop,
 * so the scenario runs in one of two shapes:
 *
 * - the bundled test edge: `scripts/saia-fs-edge.mjs` stands in for the
 *   deployment hop on `E2E_SAIA_FS_EDGE_PORT` (default 4102). Its upstream is
 *   the registry by default, or a bare instance named by `E2E_SAIA_FS_URL`
 *   (default `http://127.0.0.1:8003`, where the local stack serves saia-fs).
 *   It stamps `x-auth-claim-uid` from the claim, like a deployment gateway;
 * - a real hop: `E2E_SAIA_FS_BACKEND_URL` names the deployment origin, no
 *   harness is started, and the caller's identity travels in
 *   `fakeAuthHeaders`.
 *
 * Shared by `playwright.config.ts` and `tests/saia-fs.spec.ts` so the URL the
 * test diagnoses is the one the app really probes.
 */
export const SAIA_FS_TARGET = (() => {
  const edgePort = process.env.E2E_SAIA_FS_EDGE_PORT ?? "4102";
  const user = process.env.E2E_SAIA_FS_USER ?? "tester";
  const backend = (process.env.E2E_SAIA_FS_BACKEND_URL ?? "").replace(/\/+$/, "");
  /** A bare instance the edge forwards to, when it is not the registry. */
  const upstream = (process.env.E2E_SAIA_FS_URL ?? "").replace(/\/+$/, "");
  const edge = !backend;
  const backendUrl = backend || `http://127.0.0.1:${edgePort}`;
  return {
    edge,
    edgePort,
    user,
    upstream,
    backendUrl,
    /** The base the browser actually probes. */
    base: `${backendUrl}/mcp/saia-fs`,
    /** The account folder the scenario mounts. */
    entry: process.env.E2E_SAIA_FS_ENTRY ?? "local-testing",
  };
})();
