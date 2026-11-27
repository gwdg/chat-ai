import { agentEndpoint, agentRequestHeaders } from "../apis/agentEndpoints";

/**
 * A readable message from an error response. The upstream (or the gateway in front of it) answers
 * with a JSON body such as `{"detail":"Not Found"}`; showing that verbatim in the UI is noise, so
 * only its message field is used and anything else becomes a status message.
 *
 * A bare 404 is called out by name: `/arcana-tools/*` exists only in `back`, so a deployment whose
 * `backendPath` is a SAIA engine (or any other OpenAI-compatible endpoint) has no such API. Without
 * this, the workspace row for an old Arcana source read "Not Found", which names neither the cause
 * nor what to use instead.
 */
async function failureMessage(response: Response, path: string) {
  const text = await response.text().catch(() => "");
  let detail = "";
  if (text) {
    try {
      const body = JSON.parse(text);
      const found = [body?.detail, body?.error, body?.message].find(
        (value: unknown) => typeof value === "string" && value.trim()
      );
      detail = typeof found === "string" ? found : "";
    } catch {
      // Not JSON: a proxy error page is not worth showing.
    }
  }
  const routeMiss = /^not found$/i.test(detail.trim());
  if (response.status === 404 && (!detail || routeMiss)) {
    return `Arcana Tools is not available on this deployment: ${agentEndpoint()}${path} answered 404, because no /arcana-tools API is served there. Use the Arcanas drive (saia-rag) instead.`;
  }
  if (detail) return detail;
  return `Arcana Tools request failed (${response.status})`;
}

async function request(path: string, init?: RequestInit) {
  const auth = agentRequestHeaders();
  const requestInit = Object.keys(auth).length
    ? {
        ...init,
        headers: {
          ...(init?.headers as Record<string, string> | undefined),
          ...auth,
        },
      }
    : init;
  const response = await fetch(`${agentEndpoint()}${path}`, requestInit);
  if (!response.ok) {
    throw new Error(await failureMessage(response, path));
  }
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") ?? "";
  return type.includes("json") ? response.json() : response.text();
}

const arcanaPath = (name: string) =>
  `/arcana-tools/arcanas/${encodeURIComponent(name)}`;

export function listArcanas() {
  return request("/arcana-tools/arcanas");
}

export function createArcana(name: string, embeddingModel = "") {
  return request("/arcana-tools/arcanas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, embedding_model: embeddingModel }),
  });
}

export function getArcana(name: string) {
  return request(arcanaPath(name));
}

export function listArcanaFiles(name: string) {
  return request(`${arcanaPath(name)}/files`);
}

export function getArcanaQuota(name: string) {
  return request(`${arcanaPath(name)}/quota`).catch(() => null);
}

export function readArcanaFile(
  name: string,
  file: string,
  encoding: "utf8" | "base64" = "utf8"
) {
  const query = new URLSearchParams({ encoding });
  return request(
    `${arcanaPath(name)}/files/${encodeURIComponent(file)}/download?${query}`
  );
}

export function uploadArcanaFile(
  name: string,
  filename: string,
  content: string,
  encoding: "utf8" | "base64" = "utf8"
) {
  return request(`${arcanaPath(name)}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, content, encoding }),
  });
}

export function replaceArcanaFile(
  name: string,
  filename: string,
  content: string,
  encoding: "utf8" | "base64" = "utf8"
) {
  return request(`${arcanaPath(name)}/files/${encodeURIComponent(filename)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, encoding }),
  });
}

export function deleteArcanaFile(name: string, filename: string) {
  return request(`${arcanaPath(name)}/files/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
}

export function startArcanaIndex(name: string) {
  return request(`${arcanaPath(name)}/index`, { method: "POST" });
}

export async function getArcanaIndexStatus(name: string) {
  const [status, running] = await Promise.all([
    request(`${arcanaPath(name)}/index/status`),
    request(`${arcanaPath(name)}/index/running`),
  ]);
  return { status, running };
}

export function getArcanaIndexJob(name: string, jobId: string) {
  return request(`${arcanaPath(name)}/index/jobs/${encodeURIComponent(jobId)}`);
}

export function deleteArcanaIndex(name: string) {
  return request(`${arcanaPath(name)}/index`, { method: "DELETE" });
}

export function listArcanaMembers(name: string) {
  return request(`${arcanaPath(name)}/members`);
}

export function addArcanaMember(name: string, user: string, role = "reader") {
  return request(`${arcanaPath(name)}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, role }),
  });
}

export function removeArcanaMember(name: string, member: string) {
  return request(`${arcanaPath(name)}/members/${encodeURIComponent(member)}`, {
    method: "DELETE",
  });
}
