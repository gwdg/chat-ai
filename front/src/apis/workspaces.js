const base = () => {
  const value = import.meta.env.VITE_BACKEND_ENDPOINT ?? "";
  return String(value).replace(/\/+$/, "");
};

async function request(path, init = {}) {
  const response = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Workspace metadata request failed (${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function fetchWorkspaceSnapshot() {
  return request("/workspaces");
}

export function createWorkspaceRemote(workspace) {
  return request("/workspaces", {
    method: "POST",
    body: JSON.stringify(workspace),
  });
}

export function updateWorkspaceRemote(id, patch) {
  return request(`/workspaces/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteWorkspaceRemote(id) {
  return request(`/workspaces/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function createSourceRemote(workspaceId, source) {
  return request(`/workspaces/${encodeURIComponent(workspaceId)}/sources`, {
    method: "POST",
    body: JSON.stringify(source),
  });
}

export function updateSourceRemote(workspaceId, sourceId, patch) {
  return request(
    `/workspaces/${encodeURIComponent(workspaceId)}/sources/${encodeURIComponent(sourceId)}`,
    {
      method: "PUT",
      body: JSON.stringify(patch),
    },
  );
}

export function deleteSourceRemote(workspaceId, sourceId) {
  return request(
    `/workspaces/${encodeURIComponent(workspaceId)}/sources/${encodeURIComponent(sourceId)}`,
    { method: "DELETE" },
  );
}

export function createMountRemote(workspaceId, mount) {
  return request(`/workspaces/${encodeURIComponent(workspaceId)}/mounts`, {
    method: "POST",
    body: JSON.stringify(mount),
  });
}

export function deleteMountRemote(workspaceId, mountId) {
  return request(
    `/workspaces/${encodeURIComponent(workspaceId)}/mounts/${encodeURIComponent(mountId)}`,
    { method: "DELETE" },
  );
}

export function createChatLinkRemote(workspaceId, chat) {
  return request(`/workspaces/${encodeURIComponent(workspaceId)}/chats`, {
    method: "POST",
    body: JSON.stringify(chat),
  });
}

export function deleteChatLinkRemote(workspaceId, chatId) {
  return request(
    `/workspaces/${encodeURIComponent(workspaceId)}/chats/${encodeURIComponent(chatId)}`,
    { method: "DELETE" },
  );
}
