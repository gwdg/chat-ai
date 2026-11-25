// MCP resources for a bridged workspace, for the two hosts the browser bridge
// has: `back` (a direct OpenCode agent) and the SAIA agent service, whose
// Python copy lives in `agent-service/src/saia_agent_service/bridge_resources.py`.
//
// A server that answers `resources/list` with an error makes a client's MCP
// panel report "no MCP resources", so both hosts enumerate the workspace here.
// Every step is the same `workspace_list` / `workspace_read` call the tools use,
// which means the data still never leaves the browser except as the answer to an
// explicit read.
//
// The uri is `chatai-workspace:///<path>`. It is deliberately not `file://`: the
// path is the user's browser workspace, not a path on the agent host.

export const SCHEME = "chatai-workspace";

// Bounds: one `resources/list` must not turn into hundreds of browser round trips.
export const MAX_DIRECTORIES = 40;
export const MAX_DEPTH = 3;
export const MAX_FILES = 200;

export const RESOURCE_TEMPLATE = {
  uriTemplate: `${SCHEME}:///{path}`,
  name: "workspace file",
  description:
    "Any file in the user's selected workspace. The browser must stay connected.",
  mimeType: "text/plain",
};

const MIME_TYPES = {
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".toml": "application/toml",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".py": "text/x-python",
  ".sh": "text/x-shellscript",
  ".c": "text/x-c",
  ".h": "text/x-c",
  ".cpp": "text/x-c++",
  ".java": "text/x-java",
  ".tex": "text/x-tex",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export const resourceMime = (path, { binary = false } = {}) => {
  const lowered = String(path ?? "").toLowerCase();
  for (const [suffix, value] of Object.entries(MIME_TYPES)) {
    if (lowered.endsWith(suffix)) return value;
  }
  return binary ? "application/octet-stream" : "text/plain";
};

export const resourceUri = (path) => {
  const cleaned = `/${String(path ?? "").replace(/^\/+|\/+$/g, "")}`;
  if (cleaned === "/") return `${SCHEME}:///`;
  // Encode per segment: `encodeURI` leaves `#` and `?` alone, and a file named
  // `a#b.md` would then read as a fragment of another resource. The Python host
  // does the same with `quote(path, safe="/")`.
  const encoded = cleaned
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${SCHEME}://${encoded}`;
};

/** The workspace path of one of our uris, or null. `//segment/path` is accepted. */
export const resourcePath = (uri) => {
  const text = String(uri ?? "");
  if (!text.startsWith(`${SCHEME}://`)) return null;
  const rest = text.slice(`${SCHEME}://`.length);
  let decoded;
  try {
    decoded = decodeURIComponent(rest);
  } catch {
    decoded = rest;
  }
  return `/${decoded.replace(/^\/+|\/+$/g, "")}`;
};

const joinPath = (parent, name) =>
  `${String(parent ?? "/").replace(/\/+$/g, "")}/${name}`;

/**
 * The workspace as MCP resources.
 *
 * `call(name, args)` is the host's own relay to the browser and resolves to
 * `{ ok, result }`. A folder that cannot be listed is skipped: a provider that
 * needs permission must not make the whole bridge look broken.
 */
export async function listWorkspaceResources(call) {
  const resources = [];
  const queue = [["/", 0]];
  let visited = 0;
  while (queue.length && visited < MAX_DIRECTORIES && resources.length < MAX_FILES) {
    const [path, depth] = queue.shift();
    visited += 1;
    const answer = await call("workspace_list", { path });
    if (!answer?.ok) continue;
    for (const entry of answer.result ?? []) {
      const name = String(entry?.name ?? "");
      if (!name) continue;
      const child = joinPath(path, name);
      if (entry.dir) {
        if (depth + 1 < MAX_DEPTH) queue.push([child, depth + 1]);
        continue;
      }
      resources.push({
        uri: resourceUri(child),
        // The path, not the bare file name: a flat resource list has no folders,
        // so `README.md` would appear three times.
        name: child.replace(/^\/+/, ""),
        mimeType: resourceMime(child),
      });
      if (resources.length >= MAX_FILES) break;
    }
  }
  return { resources };
}

/**
 * Read one resource: `{ contents }` or `{ error }`.
 *
 * Text becomes `text`, binary becomes base64 `blob`, and a file the bridge
 * refuses is an error because a resource read has no other way to say
 * "here is metadata instead".
 */
export async function readWorkspaceResource(call, uri) {
  const text = String(uri ?? "").trim();
  const path = resourcePath(text);
  if (path === null) {
    return { error: `Not a workspace resource: ${text || "(empty)"}` };
  }
  const answer = await call("workspace_read", { path });
  if (!answer?.ok) {
    return { error: String(answer?.error ?? "The workspace could not read that file.") };
  }
  const value = answer.result;
  if (!value || typeof value !== "object") {
    return { error: "The workspace returned an unexpected answer." };
  }
  if (value.content === undefined || value.content === null) {
    return { error: String(value.message ?? "That file cannot be read through the bridge.") };
  }
  const binary = value.encoding === "base64";
  const item = { uri: text, mimeType: resourceMime(path, { binary }) };
  if (binary) item.blob = String(value.content);
  else item.text = String(value.content);
  return { contents: [item] };
}
