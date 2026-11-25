/**
 * Where the opt-in saia-fs scenario points the app.
 *
 * Chat AI reaches the filesystem at `<backendPath>/saia-fs`, a path only a
 * deployment hop can serve (it forwards to the SAIA registry and stamps the
 * caller's identity). Two shapes exist:
 *
 * - a deployment hop: `E2E_SAIA_FS_EDGE=harness` starts the bundled test edge,
 *   or `E2E_SAIA_FS_BACKEND_URL` names a real one;
 * - a bare saia-fs instance: `E2E_SAIA_FS_URL` (default
 *   `http://127.0.0.1:8003`, where the local stack serves it). It becomes
 *   `saiaFsEndpoint` in the generated config, and the caller's identity travels
 *   in `fakeAuthHeaders` because no hop stamps it.
 *
 * Shared by `playwright.config.ts` and `tests/saia-fs.spec.ts` so the URL the
 * test diagnoses is the one the app really probes.
 */
export const SAIA_FS_TARGET = (() => {
  const edge = (process.env.E2E_SAIA_FS_EDGE ?? "off") === "harness";
  const edgePort = process.env.E2E_SAIA_FS_EDGE_PORT ?? "4102";
  const user = process.env.E2E_SAIA_FS_USER ?? "tester";
  const deployment = edge || Boolean(process.env.E2E_SAIA_FS_BACKEND_URL);
  const endpoint = (
    process.env.E2E_SAIA_FS_URL ?? (deployment ? "" : "http://127.0.0.1:8003")
  ).replace(/\/+$/, "");
  const backendUrl = (
    process.env.E2E_SAIA_FS_BACKEND_URL ??
    (edge ? `http://127.0.0.1:${edgePort}` : "http://127.0.0.1:10000/public/v1")
  ).replace(/\/+$/, "");
  return {
    edge,
    edgePort,
    user,
    /** `saiaFsEndpoint` for the generated config, empty for the deployment path. */
    endpoint,
    backendUrl,
    /** The base the browser actually probes. */
    base: endpoint || `${backendUrl}/saia-fs`,
    /** The account folder the scenario mounts. */
    entry: process.env.E2E_SAIA_FS_ENTRY ?? "local-testing",
  };
})();
