import { agentEndpoint } from "../apis/agentEndpoints";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${agentEndpoint()}${path}`, init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `ArcanaV2 request failed (${response.status})`);
  }
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") ?? "";
  return type.includes("json") ? response.json() : response.text();
}

const arcanaPath = (name: string) =>
  `/arcana-v2/arcanas/${encodeURIComponent(name)}`;

export function listArcanas() {
  return request("/arcana-v2/arcanas");
}

export function createArcana(name: string, embeddingModel = "") {
  return request("/arcana-v2/arcanas", {
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
