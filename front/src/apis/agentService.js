// Client for the SAIA agent service (agent-service/). It owns one OpenCode
// backend per frontend user, so the browser never has to reach a machine that
// runs the agent directly. The browser calls the service on the app's own
// origin: the SAIA gateway routes `/agents/*` to it. An agent created here
// stores `/agents/<id>/opencode` as its proxy prefix, and the OpenCode client
// then talks to `<prefix>/api/...` unchanged.

/** The service's routes on the app origin, served by the SAIA gateway. */
export const AGENT_SERVICE_PATH = "/agents";

/**
 * The model the service is registered as in the SAIA engine.
 *
 * It sits in an engine access group (`agent` by default), so `/v1/models` lists
 * it only for a user that was granted that group. The model list is therefore
 * the entitlement answer for this user, and
 * `hooks/useAgentServiceAccess.js` reads it before the add-agent dialog offers
 * the service fields.
 */
export const AGENT_SERVICE_MODEL = "saia-agent";

export const serviceOpencodeUrl = (agentId) =>
  `${AGENT_SERVICE_PATH}/${encodeURIComponent(agentId)}/opencode`;

/** Emitted when the service answers 409 for an agent the browser cannot use. */
export const AGENT_SERVICE_CONFLICT_EVENT = "chatai:agent-service-conflict";

/**
 * The fields the service puts beside `detail` in an error body.
 *
 * It answers JSON with a stable `code`, and a conflict names the agent and the
 * status of its row (`{"detail": "...", "code": "conflict", "agent_id": "...",
 * "status": "failed"}`). Proxied OpenCode errors are not the service's own, so
 * they do not carry those fields.
 */
export const serviceErrorDetails = (raw) => {
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  return {
    body,
    detail: body?.detail || body?.message || raw,
    code: body?.code ?? null,
    status: body?.status ?? null,
    agentId: body?.agent_id ?? null,
  };
};

/**
 * Tell the app that a service-managed agent cannot be used.
 *
 * The service reports `conflict` for a row it will not serve (a failed or
 * terminated instance). Nothing in this client can repair that, so the listener
 * removes the agent instead of retrying a dead proxy on every poll.
 */
export function reportAgentConflict({
  serviceAgentId,
  agentId = null,
  code = null,
  status = null,
  message = "",
}) {
  if (typeof window === "undefined" || !serviceAgentId) return;
  window.dispatchEvent(
    new CustomEvent(AGENT_SERVICE_CONFLICT_EVENT, {
      detail: {
        serviceAgentId,
        agentId,
        code,
        status,
        message: String(message ?? ""),
      },
    }),
  );
}

async function request(path, init = {}) {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    const details = serviceErrorDetails(raw);
    if (response.status === 409 && details.code === "conflict" && details.agentId) {
      reportAgentConflict({
        serviceAgentId: details.agentId,
        code: details.code,
        status: details.status,
        message: details.detail,
      });
    }
    const error = new Error(
      `agent service responded with ${response.status}${
        details.detail ? `: ${String(details.detail).slice(0, 200)}` : ""
      }`,
    );
    error.status = response.status;
    error.code = details.code;
    error.body = details.body;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function createServiceAgent({ name } = {}) {
  const agent = await request("/agents", {
    method: "POST",
    body: JSON.stringify(name ? { name } : {}),
  });
  if (agent?.status !== "running") {
    throw new Error(
      agent?.last_error ||
        `the agent service reports status ${agent?.status ?? "unknown"}`,
    );
  }
  return {
    serviceAgentId: agent.id,
    serverUrl: serviceOpencodeUrl(agent.id),
    serviceStatus: agent.status,
  };
}

export async function startServiceAgent(agentId) {
  const agent = await request(
    `/agents/${encodeURIComponent(agentId)}/start`,
    { method: "POST" },
  );
  if (agent?.status !== "running") {
    throw new Error(
      agent?.last_error ||
        `the agent service reports status ${agent?.status ?? "unknown"}`,
    );
  }
  return agent;
}

export async function deleteServiceAgent(agentId) {
  try {
    await request(`/agents/${encodeURIComponent(agentId)}`, {
      method: "DELETE",
    });
  } catch (error) {
    // A 404 means the service already forgot it; there is nothing to stop.
    if (!/responded with 404\b/.test(String(error?.message))) throw error;
  }
}

export async function listServiceAgents() {
  return (await request("/agents")) ?? [];
}
