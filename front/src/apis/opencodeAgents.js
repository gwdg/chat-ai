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

async function rawRequest(agent, path, init = {}) {
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
  return response;
}

async function request(agent, path, init = {}) {
  const response = await rawRequest(agent, path, init);
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

export async function listOpencodeFiles(agent, path = "") {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  const result = await request(agent, `/fs/list${query}`);
  return result?.data ?? [];
}

export async function readOpencodeFile(agent, path) {
  const encoded = String(path)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const response = await rawRequest(agent, `/fs/read/${encoded}`);
  return {
    blob: await response.blob(),
    type: response.headers.get("content-type") ?? "",
  };
}

export async function writeOpencodeFile(
  agent,
  path,
  data,
  type = "application/octet-stream",
) {
  const query = new URLSearchParams({ path });
  const response = await rawRequest(
    agent,
    `/experimental/fs/write?${query.toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": type },
      body: data,
    },
  );
  if (response.status === 204) return null;
  return response.json();
}

export async function getOpencodeDiff(agent, sessionId) {
  const result = await request(
    agent,
    `/session/${encodeURIComponent(sessionId)}/diff`,
  );
  return result?.data ?? [];
}

export async function stageOpencodeRevert(
  agent,
  sessionId,
  messageID,
  files = true,
) {
  return request(
    agent,
    `/session/${encodeURIComponent(sessionId)}/revert/stage`,
    {
      method: "POST",
      body: JSON.stringify({ messageID, files }),
    },
  );
}

export async function clearOpencodeRevert(agent, sessionId) {
  return request(agent, `/session/${encodeURIComponent(sessionId)}/revert`, {
    method: "DELETE",
  });
}

export async function commitOpencodeRevert(agent, sessionId) {
  return request(
    agent,
    `/session/${encodeURIComponent(sessionId)}/revert/commit`,
    { method: "POST" },
  );
}

export async function listOpencodeForms(agent, sessionId) {
  const result = await request(
    agent,
    `/session/${encodeURIComponent(sessionId)}/form`,
  );
  return result?.data ?? [];
}

export async function replyOpencodeForm(agent, sessionId, formId, answer) {
  return request(
    agent,
    `/session/${encodeURIComponent(sessionId)}/form/${encodeURIComponent(formId)}/reply`,
    { method: "POST", body: JSON.stringify({ answer }) },
  );
}

export async function getOpencodeContext(agent, sessionId) {
  return request(agent, `/session/${encodeURIComponent(sessionId)}/context`);
}

export async function listSavedOpencodePermissions(agent, projectID) {
  const query = projectID
    ? `?projectID=${encodeURIComponent(projectID)}`
    : "";
  const result = await request(agent, `/permission/saved${query}`);
  return result?.data ?? [];
}

export async function deleteSavedOpencodePermission(agent, id) {
  return request(agent, `/permission/saved/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listOpencodeMcpServers(agent) {
  const result = await request(agent, "/mcp");
  return result?.data ?? [];
}

export async function addOpencodeMcpServer(agent, name, config) {
  return request(agent, `/experimental/mcp/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify({ config }),
  });
}

export async function connectOpencodeMcpServer(agent, name) {
  return request(
    agent,
    `/experimental/mcp/${encodeURIComponent(name)}/connect`,
    { method: "POST" },
  );
}

export async function removeOpencodeMcpServer(agent, name) {
  return request(agent, `/experimental/mcp/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function findOpencodeFiles(agent, query, limit = 100) {
  const params = new URLSearchParams({ query, limit: String(limit) });
  const result = await request(agent, `/fs/find?${params.toString()}`);
  return result?.data ?? [];
}

export async function subscribeOpencodeEvents(agent, onEvent, signal) {
  const response = await rawRequest(agent, "/event", { signal });
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const data = chunk
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!data) continue;
        try {
          onEvent(JSON.parse(data));
        } catch {
          onEvent(null);
        }
      }
    }
  } catch (reason) {
    if (!signal?.aborted) throw reason;
  }
}

export async function listOpencodeCommands(agent) {
  const result = await request(agent, "/command");
  return result?.data ?? [];
}

export async function listOpencodeAgents(agent) {
  const result = await request(agent, "/agent");
  return result?.data ?? [];
}

export async function setOpencodeAgent(agent, sessionId, agentId) {
  return request(agent, `/session/${encodeURIComponent(sessionId)}/agent`, {
    method: "POST",
    body: JSON.stringify({ agent: agentId }),
  });
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

export async function sendOpencodePrompt(agent, sessionId, text, files = []) {
  return request(agent, `/session/${encodeURIComponent(sessionId)}/prompt`, {
    method: "POST",
    body: JSON.stringify({
      text,
      ...(files.length ? { files } : {}),
    }),
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
