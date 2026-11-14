// Client for a local `opencode serve` instance. The browser talks to the server directly;
// opencode allows CORS from the app origin and protects the API with HTTP basic auth.
const DEFAULT_SERVER_URL = "http://127.0.0.1:9000";
const DEFAULT_SERVER_USERNAME = "opencode";

export const opencodeDefaults = () => ({
  serverUrl: import.meta.env.VITE_OPENCODE_SERVER_URL || DEFAULT_SERVER_URL,
  username:
    import.meta.env.VITE_OPENCODE_SERVER_USERNAME || DEFAULT_SERVER_USERNAME,
  password: import.meta.env.VITE_OPENCODE_SERVER_PASSWORD || "",
});

const baseUrl = (agent) =>
  String(agent?.serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, "");

const authHeaders = (agent) => {
  const username = agent?.username || DEFAULT_SERVER_USERNAME;
  const password = agent?.password;
  if (!password) return {};
  return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
};

async function request(agent, path, init = {}) {
  const response = await fetch(`${baseUrl(agent)}/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(agent),
      ...init.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("The opencode server rejected the password.");
    }
    const detail = await response.text().catch(() => "");
    throw new Error(
      `opencode server responded with ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function getOpencodeInfo(agent) {
  return request(agent, "/info");
}

export async function createOpencodeSession(agent, title) {
  const result = await request(agent, "/session", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return result?.data ?? result;
}

export async function listOpencodeCommands(agent) {
  const result = await request(agent, "/command");
  return result?.data ?? [];
}

export async function listOpencodeModels(agent) {
  const result = await request(agent, "/model");
  return result?.data ?? [];
}

export async function getOpencodeDefaultModel(agent) {
  const result = await request(agent, "/model/default");
  return result?.data ?? null;
}

export async function getOpencodeSession(agent, sessionId) {
  const result = await request(
    agent,
    `/session/${encodeURIComponent(sessionId)}`,
  );
  return result?.data ?? result;
}

export async function setOpencodeModel(agent, sessionId, model) {
  return request(agent, `/session/${encodeURIComponent(sessionId)}/model`, {
    method: "POST",
    body: JSON.stringify({
      model: { id: model.id, providerID: model.providerID },
    }),
  });
}

export async function listOpencodeMessages(agent, sessionId) {
  const result = await request(
    agent,
    `/session/${encodeURIComponent(sessionId)}/message?order=asc`,
  );
  return result?.data ?? [];
}

export async function sendOpencodePrompt(agent, sessionId, text) {
  return request(agent, `/session/${encodeURIComponent(sessionId)}/prompt`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function deleteOpencodeSession(agent, sessionId) {
  return request(agent, `/session/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export async function interruptOpencodeSession(agent, sessionId, resume = false) {
  return request(
    agent,
    `/session/${encodeURIComponent(sessionId)}/interrupt${resume ? "?resume=true" : ""}`,
    { method: "POST" },
  );
}

export async function sendOpencodeCommand(agent, sessionId, name, text = "") {
  return request(agent, `/session/${encodeURIComponent(sessionId)}/command`, {
    method: "POST",
    body: JSON.stringify({ name, text }),
  });
}

export async function listOpencodePermissions(agent, sessionId) {
  const result = await request(
    agent,
    `/session/${encodeURIComponent(sessionId)}/permission`,
  );
  return result?.data ?? [];
}

export async function replyOpencodePermission(
  agent,
  sessionId,
  requestId,
  decision,
  message,
) {
  return request(
    agent,
    `/session/${encodeURIComponent(sessionId)}/permission/${encodeURIComponent(requestId)}/reply`,
    {
      method: "POST",
      body: JSON.stringify({
        decision,
        ...(message ? { message } : {}),
      }),
    },
  );
}

export async function compactOpencodeSession(agent, sessionId) {
  return request(agent, `/session/${encodeURIComponent(sessionId)}/compact`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function runOpencodeShell(agent, sessionId, command) {
  return request(agent, `/session/${encodeURIComponent(sessionId)}/shell`, {
    method: "POST",
    body: JSON.stringify({ command }),
  });
}

export async function cancelOpencodeInbox(agent, sessionId, inboxId) {
  return request(
    agent,
    `/session/${encodeURIComponent(sessionId)}/inbox/${encodeURIComponent(inboxId)}`,
    { method: "DELETE" },
  );
}
