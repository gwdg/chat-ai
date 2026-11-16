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
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }
    const detail = body?.detail || body?.message || raw;
    throw new Error(
      `agent service responded with ${response.status}${
        detail ? `: ${String(detail).slice(0, 200)}` : ""
      }`,
    );
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
