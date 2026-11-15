import {
  listOpencodeFiles,
  readOpencodeFile,
  runOpencodeShellAndWait,
} from "../apis/opencodeAgents";
import { joinPath, normalizePath } from "./paths";
import {
  MANIFEST_FILENAME,
  MANIFEST_MAX_BYTES,
  parseWorkspaceManifest,
} from "../utils/workspaceManifest";

export const CLONE_MARKER = "CHATAI_GIT_CLONE";
export const MAX_IMPORT_FILES = 20000;
export const MAX_IMPORT_BYTES = 1024 * 1024 * 1024;

const shellQuote = (value) =>
  `'${String(value).replace(/'/g, "'\\''")}'`;

const remotePath = (path) => normalizePath(path).replace(/^\/+/, "");

export const parsePublicGitUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Repository URL is required");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Repository URL is invalid");
  }
  if (url.protocol !== "https:") {
    throw new Error("Only public HTTPS Git repositories are supported");
  }
  if (url.username || url.password) {
    throw new Error("Credentials in repository URLs are not allowed");
  }
  return url.toString();
};

export const cloneId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export async function cloneRepositoryWithAgent({
  agent,
  url,
  branch,
  id,
  onProgress,
}) {
  if (!agent?.sessionId) throw new Error("The selected agent has no session");
  const target = parsePublicGitUrl(url);
  const tempBase = `.chat-ai-clones/${id}`;
  const repoDir = `${tempBase}/repo`;
  const branchArg = String(branch || "").trim()
    ? `--branch ${shellQuote(String(branch).trim())} `
    : "";
  onProgress?.("clone");
  const command = [
    `mkdir -p ${shellQuote(tempBase)}`,
    `git clone ${branchArg}${shellQuote(target)} ${shellQuote(repoDir)} 2>&1`,
    `code=$?`,
    `echo ${CLONE_MARKER}_EXIT:$code`,
    `# ${CLONE_MARKER}`,
  ].join("; ");
  const output = await runOpencodeShellAndWait(
    agent,
    agent.sessionId,
    command,
    10 * 60 * 1000,
  );
  if (!output.includes(`${CLONE_MARKER}_EXIT:0`)) {
    const detail = String(output || "")
      .split("\n")
      .filter((line) => line.trim() && !line.includes(`${CLONE_MARKER}_EXIT:`))
      .slice(-8)
      .join("\n");
    throw new Error(detail || "git clone failed");
  }
  return { tempBase, repoDir };
}

export async function cleanupAgentClone(agent, tempBase) {
  if (!agent?.sessionId || !tempBase) return;
  await runOpencodeShellAndWait(
    agent,
    agent.sessionId,
    `rm -rf ${shellQuote(tempBase)} # ${CLONE_MARKER}`,
    60000,
  ).catch(() => {});
}

export async function moveAgentCloneToTarget({
  agent,
  repoDir,
  targetPath,
}) {
  const target = normalizePath(targetPath).replace(/^\/+/, "");
  if (!target || target.split("/").includes("..")) {
    throw new Error("Invalid agent storage target");
  }
  const parent = target.split("/").slice(0, -1).join("/");
  const command = [
    `if [ -e ${shellQuote(target)} ]; then echo ${CLONE_MARKER}_TARGET_EXISTS; exit 1; fi`,
    ...(parent ? [`mkdir -p ${shellQuote(parent)}`] : []),
    `mv ${shellQuote(repoDir)} ${shellQuote(target)}`,
    `echo ${CLONE_MARKER}_TARGET_OK`,
    `# ${CLONE_MARKER}`,
  ].join("; ");
  const output = await runOpencodeShellAndWait(
    agent,
    agent.sessionId,
    command,
    60000,
  );
  if (!output.includes(`${CLONE_MARKER}_TARGET_OK`)) {
    if (output.includes(`${CLONE_MARKER}_TARGET_EXISTS`)) {
      throw new Error("The target folder already exists");
    }
    throw new Error("Could not move the clone into agent storage");
  }
}

export async function readManifestFromAgent(agent, repoDir) {
  try {
    const { blob } = await readOpencodeFile(
      agent,
      `${repoDir}/${MANIFEST_FILENAME}`,
    );
    if (blob.size > MANIFEST_MAX_BYTES) {
      throw new Error(`${MANIFEST_FILENAME} is too large`);
    }
    return parseWorkspaceManifest(await blob.text());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/404|not found|enoent/i.test(message)) return null;
    throw error;
  }
}

async function walkAgentProject({
  agent,
  repoDir,
  onDirectory,
  onFile,
}) {
  const root = normalizePath(repoDir);
  let files = 0;
  let bytes = 0;
  const seen = new Set();

  const walk = async (remote) => {
    const normalizedRemote = normalizePath(remote);
    if (seen.has(normalizedRemote)) return;
    seen.add(normalizedRemote);
    const rows = await listOpencodeFiles(agent, remotePath(normalizedRemote));
    for (const row of Array.isArray(rows) ? rows : []) {
      const full = normalizePath(row?.path || "");
      const relative =
        full === root
          ? ""
          : full.startsWith(`${root}/`)
            ? full.slice(root.length + 1)
            : String(row?.name || "");
      if (!relative) continue;
      if (row?.type === "directory") {
        await onDirectory?.(full, relative);
        await walk(full);
        continue;
      }
      files += 1;
      bytes += Number(row?.size) || 0;
      if (files > MAX_IMPORT_FILES) {
        throw new Error(`Repository exceeds ${MAX_IMPORT_FILES} files`);
      }
      if (bytes > MAX_IMPORT_BYTES) {
        throw new Error("Repository exceeds the 1 GB import limit");
      }
      await onFile?.(full, relative, row, files, bytes);
    }
  };

  await walk(root);
  return { files, bytes };
}

export function measureAgentProject(agent, repoDir) {
  return walkAgentProject({ agent, repoDir });
}

export async function copyAgentProjectToProvider({
  agent,
  repoDir,
  provider,
  targetRoot,
  onProgress,
}) {
  if (provider.status !== "connected") await provider.connect();
  const root = normalizePath(targetRoot);
  if (provider.capabilities?.mkdir) await provider.mkdir(root).catch(() => {});
  return walkAgentProject({
    agent,
    repoDir,
    onDirectory: async (_remote, relative) => {
      if (provider.capabilities?.mkdir) {
        await provider.mkdir(joinPath(root, relative));
      }
    },
    onFile: async (remote, relative, row, files, bytes) => {
      const { blob } = await readOpencodeFile(agent, remotePath(remote));
      await provider.write(
        joinPath(root, relative),
        blob.stream(),
        { size: blob.size || row?.size, overwrite: true },
      );
      if (files % 40 === 0) onProgress?.({ files, bytes });
    },
  });
}
