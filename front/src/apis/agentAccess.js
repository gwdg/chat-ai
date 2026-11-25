// Which agent connections the browser is allowed to make itself.
//
// In a deployment every agent lives behind SAIA: the browser reaches the agent
// service through the gateway, and its per-agent OpenCode backends through the
// service proxy. A direct `opencode serve` connection is a development
// affordance, so it is limited to a Chat AI that is opened from the same
// machine (loopback). `apis/opencodeAgents.js` enforces this for every request,
// and the add/edit dialog does not offer direct mode outside that case.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** True for a loopback hostname, with or without the IPv6 brackets. */
export const isLoopbackHost = (hostname) =>
  LOOPBACK_HOSTS.has(
    String(hostname ?? "")
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, ""),
  );

const appHostname = () =>
  typeof window === "undefined" ? "" : window.location.hostname;

/** Direct OpenCode connections are only allowed when the app runs locally. */
export const directAgentAccessAllowed = (hostname = appHostname()) =>
  isLoopbackHost(hostname);

/** The agent is served by the agent service, which is reachable through SAIA. */
export const isServiceManagedAgent = (agent) =>
  Boolean(agent?.serviceAgentId);
