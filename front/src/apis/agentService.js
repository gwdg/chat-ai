// Client for the SAIA agent service (agent-service/). It owns one OpenCode
// backend per frontend user, so the browser never has to reach a machine that
// runs the agent directly. An agent created here stores the service's proxy
// prefix as its `serverUrl`; the OpenCode client then talks to
// `<service>/agents/<id>/opencode/api/...` unchanged.

export const agentServiceUrl = () =>
  String(import.meta.env.VITE_AGENT_SERVICE_URL || "").replace(/\/+$/, "");

export const hasAgentService = () => Boolean(agentServiceUrl());

export const serviceOpencodeUrl = (agentId) =>
  `${agentServiceUrl()}/agents/${encodeURIComponent(agentId)}/opencode`;

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
  const base = agentServiceUrl();
  if (!base) throw new Error("The agent service is not configured.");
  const response = await fetch(`${base}${path}`, {
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
