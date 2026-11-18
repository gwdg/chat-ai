// Client for an `opencode serve` instance. A local one is called directly;
// opencode allows CORS from the app origin and protects the API with HTTP basic
// auth. In a deployment the same client talks to the agent service's per-agent
// proxy (`<gateway>/agents/<id>/opencode`), which is why only the base URL differs.
import {
  reportAgentConflict,
  serviceErrorDetails,
  serviceOpencodeUrl,
} from "./agentService";
import {
  directAgentAccessAllowed,
  isServiceManagedAgent,
} from "./agentAccess";

const DEFAULT_SERVER_URL = "http://127.0.0.1:9000";
const DEFAULT_SERVER_USERNAME = "opencode";

/**
 * A direct OpenCode server is only reachable from a local Chat AI. Everything
 * else must go through the agent service, which sits behind SAIA.
 */
export const DIRECT_AGENT_BLOCKED =
  "Direct agent connections are only available when Chat AI runs locally. In a deployment, agents run through the agent service (SAIA).";

/**
 * The server did not answer with the OpenCode API at all.
 *
 * A deployment answers on the app's own origin, so a service that is down (or a
 * gateway that cannot reach it) replies with an HTML error page — sometimes even
 * with status 200. Parsing that as JSON produced `Unexpected token '<'`, which
 * told a user nothing; callers get this error instead and can decide to hide the
 * affected UI.
 */
export const AGENT_SERVER_UNAVAILABLE = "The agent server is unavailable.";

/** True for the "no API behind this URL" error, as opposed to an API error. */
export const isAgentServerUnavailable = (error) =>
  error?.code === "AGENT_SERVER_UNAVAILABLE";

const unavailableError = (detail) => {
  const error = new Error(AGENT_SERVER_UNAVAILABLE);
  error.code = "AGENT_SERVER_UNAVAILABLE";
  if (detail) error.cause = detail;
  return error;
};

const looksLikeHtml = (text) => /^\s*(?:<!doctype|<html|<\?xml)/i.test(text);

export const opencodeDefaults = () => ({
  serverUrl: import.meta.env.VITE_OPENCODE_SERVER_URL || DEFAULT_SERVER_URL,
  username:
    import.meta.env.VITE_OPENCODE_SERVER_USERNAME || DEFAULT_SERVER_USERNAME,
  password: import.meta.env.VITE_OPENCODE_SERVER_PASSWORD || "",
});

const baseUrl = (agent) =>
  // A service-managed agent is served by the agent service on this origin; the
  // `serverUrl` stored at creation is only a display value, so a changed
  // deployment or a copied config cannot pin the browser to another host.
  isServiceManagedAgent(agent)
    ? serviceOpencodeUrl(agent.serviceAgentId)
    : String(agent?.serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, "");

const authHeaders = (agent) => {
  const username = agent?.username || DEFAULT_SERVER_USERNAME;
  const password = agent?.password;
  if (!password) return {};
  return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
};

async function rawRequest(agent, path, init = {}) {
  // Outside a locally opened Chat AI only the agent service may be used, and it
  // is always the app's own origin: a direct OpenCode server is never contacted.
  if (!directAgentAccessAllowed() && !isServiceManagedAgent(agent)) {
    throw new Error(DIRECT_AGENT_BLOCKED);
  }
  let response;
  try {
    response = await fetch(`${baseUrl(agent)}/api${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...authHeaders(agent),
        ...init.headers,
      },
    });
  } catch (reason) {
    // An abort is the caller's own signal, not a server problem.
    if (init.signal?.aborted || reason?.name === "AbortError") throw reason;
    throw unavailableError(reason);
  }
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("The opencode server rejected the password.");
    }
    const detail = await response.text().catch(() => "");
    // A gateway in front of the agent service answers with its own error page
    // when the service is down; that is not an OpenCode API error.
    if (looksLikeHtml(detail) || [502, 503, 504].includes(response.status)) {
      throw unavailableError(`HTTP ${response.status}`);
    }
    // A service-managed agent is proxied through the agent service. A 409 with
    // its conflict code means the service will not serve that row at all (for
    // example after a restart marked it failed), which no retry can fix.
    if (response.status === 409 && agent?.serviceAgentId) {
      const service = serviceErrorDetails(detail);
      const isServiceConflict =
        service.code === "conflict" ||
        service.agentId === agent.serviceAgentId;
      if (isServiceConflict) {
        reportAgentConflict({
          serviceAgentId: agent.serviceAgentId,
          agentId: agent.id,
          code: service.code,
          status: service.status,
          message: service.detail,
        });
      }
    }
    throw new Error(
      `opencode server responded with ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }
  return response;
}

/**
 * Parse a JSON body, but treat a non-JSON answer as "no API here" instead of
 * letting `JSON.parse` leak a syntax error to the user.
 */
async function parseJson(response) {
  const text = await response.text().catch(() => "");
  if (!text.trim()) return null;
  if (looksLikeHtml(text)) {
    throw unavailableError(`HTTP ${response.status} served HTML`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw unavailableError(`HTTP ${response.status} served invalid JSON`);
  }
}

async function request(agent, path, init = {}) {
  const response = await rawRequest(agent, path, init);
  if (response.status === 204) return null;
  return parseJson(response);
}

export async function getOpencodeInfo(agent) {
  return request(agent, "/info");
}

export async function getOpencodeHealth(agent) {
  return request(agent, "/global/health");
}

export async function getOpencodePath(agent) {
  return request(agent, "/path");
}

export async function getOpencodeVcs(agent) {
  return request(agent, "/vcs");
}

export async function getOpencodeFileStatus(agent) {
  const result = await request(agent, "/file/status");
  return result?.data ?? result ?? [];
}

export async function listOpencodeTodos(agent, sessionId) {
  const result = await request(
    agent,
    `/session/${encodeURIComponent(sessionId)}/todo`,
  );
  return result?.data ?? result ?? [];
}

export async function listOpencodeSessions(agent) {
  const result = await request(agent, "/session");
  return result?.data ?? result ?? [];
}

export async function listOpencodeSessionChildren(agent, sessionId) {
  const parentId = String(sessionId);
  // Current OpenCode filters the session list by parentID; `/session/<id>/children` is gone
  // and answers 404 there. Older servers only have the dedicated endpoint, so try the filter
  // first and fall back when the server ignored it.
  try {
    const listed = await request(
      agent,
      `/session?parentID=${encodeURIComponent(parentId)}&limit=200`,
    );
    const sessions = listed?.data ?? listed;
    if (
      Array.isArray(sessions) &&
      sessions.every(
        (session) => (session.parentID || session.parentId) === parentId,
      )
    ) {
      return sessions;
    }
  } catch {
    // Fall through to the dedicated endpoint.
  }
  const result = await request(
    agent,
    `/session/${encodeURIComponent(parentId)}/children`,
  );
  return result?.data ?? result ?? [];
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
  return parseJson(response);
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

export async function putOpencodeInstructionEntry(
  agent,
  sessionId,
  key,
  value,
) {
  return request(
    agent,
    `/experimental/session/${encodeURIComponent(sessionId)}/instructions/entries/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      body: JSON.stringify({ value }),
    },
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

export async function getOpencodeSessionStatus(agent) {
  try {
    // OpenCode v2 exposes only active sessions; absence means idle.
    const result = await request(agent, "/session/active");
    return result?.data ?? result ?? {};
  } catch {
    // OpenCode v1 returned a status entry for every session.
    const result = await request(agent, "/session/status");
    return result?.data ?? result ?? {};
  }
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

const MESSAGE_PAGE_SIZE = 200;
const MAX_MESSAGE_PAGES = 20;

/**
 * Load messages newest-first until `newestId` is reached, so a poll only transfers the
 * messages that are not cached yet. Without `newestId` this reads the whole history.
 */
async function fetchMessagePages(agent, sessionId, newestId = null) {
  const base = `/session/${encodeURIComponent(sessionId)}/message`;
  const messages = [];
  let params = new URLSearchParams({
    order: "desc",
    limit: String(MESSAGE_PAGE_SIZE),
  });
  let complete = !newestId;
  for (let page = 0; page < MAX_MESSAGE_PAGES; page += 1) {
    const result = await request(agent, `${base}?${params.toString()}`);
    const data = Array.isArray(result?.data) ? result.data : [];
    messages.push(...data);
    if (newestId && data.some((message) => message?.id === newestId)) {
      complete = true;
      break;
    }
    const cursor = result?.cursor?.next;
    if (!cursor) {
      complete = true;
      break;
    }
    params = new URLSearchParams({
      limit: String(MESSAGE_PAGE_SIZE),
      cursor,
    });
  }
  return { messages: messages.reverse(), complete };
}

export async function listOpencodeMessagesPage(
  agent,
  sessionId,
  options = {},
) {
  return fetchMessagePages(agent, sessionId, options.newestId ?? null);
}

export async function listOpencodeMessages(agent, sessionId) {
  const { messages } = await fetchMessagePages(agent, sessionId);
  return messages;
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

export async function renameOpencodeSession(agent, sessionId, title) {
  return request(agent, `/session/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
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

const shellResultText = (result) => {
  const parts = result?.parts ?? result?.data?.parts ?? [];
  return parts
    .map((part) => {
      const value =
        part?.text ??
        part?.state?.output ??
        part?.output ??
        part?.state?.metadata?.output;
      if (value === undefined || value === null) return "";
      return typeof value === "string" ? value : JSON.stringify(value, null, 2);
    })
    .filter(Boolean)
    .join("\n");
};

export async function runOpencodeShellAndWait(
  agent,
  sessionId,
  command,
  timeoutMs = 15000,
) {
  const controller = new AbortController();
  let shellId = null;
  let markConnected;
  const connected = new Promise((resolve) => {
    markConnected = resolve;
  });
  let markDone;
  const finished = new Promise((resolve) => {
    markDone = resolve;
  });

  void subscribeOpencodeEvents(
    agent,
    (event) => {
      markConnected?.();
      const type = event?.type;
      const shell = event?.data?.shell;
      if (type === "session.shell.started" && shell?.id) shellId = shell.id;
      if (type !== "session.shell.ended" || !shell) return;
      if (shellId) {
        if (shell.id && shell.id !== shellId) return;
      } else if (shell.command && shell.command !== command) {
        return;
      }
      markDone?.(event?.data?.output?.output ?? "");
    },
    controller.signal,
  ).catch(() => {
    markConnected?.();
    markDone?.("");
  });

  await Promise.race([
    connected,
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);

  try {
    const result = await runOpencodeShell(agent, sessionId, command);
    const fromResult = shellResultText(result);
    if (fromResult.trim()) return fromResult;
    const output = await Promise.race([
      finished,
      new Promise((resolve) => setTimeout(() => resolve(""), timeoutMs)),
    ]);
    return String(output ?? "");
  } finally {
    controller.abort();
  }
}

export async function cancelOpencodeInbox(agent, sessionId, inboxId) {
  return request(
    agent,
    `/session/${encodeURIComponent(sessionId)}/inbox/${encodeURIComponent(inboxId)}`,
    { method: "DELETE" },
  );
}
