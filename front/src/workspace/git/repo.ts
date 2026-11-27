import { joinPath } from "../paths";
import type { FileProvider } from "../providers/types";
import { createProviderGitFs, type GitFs } from "./providerFs";

/**
 * Git in the browser, over a workspace source.
 *
 * Workspace files live in IndexedDB, in a picked local folder or on saia-fs,
 * where no OpenCode agent can see them. isomorphic-git reads and writes the
 * repository through `providerFs`, so init, clone, stage, commit, branches and
 * remotes work on all three without a server-side checkout.
 *
 * The library (~570 kB) and its HTTP plugin are imported on first use.
 */

export type GitCredentials = { username?: string; password?: string };

export type GitIdentity = { name: string; email: string };

export type GitFile = {
  /** Repo-relative path. */
  path: string;
  /** Index status: "A", "M", "D" or " " (unchanged). */
  index: string;
  /** Worktree status: "M", "D", "?" or " ". */
  worktree: string;
  untracked: boolean;
  staged: boolean;
  unstaged: boolean;
  deleted: boolean;
};

export type GitStatus = {
  branch: string | null;
  detached: boolean;
  files: GitFile[];
  clean: boolean;
};

export type GitBranchInfo = {
  local: string[];
  remote: string[];
  current: string | null;
};

export type GitRemote = { name: string; url: string };

export type GitCommit = {
  oid: string;
  message: string;
  author: string;
  email: string;
  /** Milliseconds since epoch. */
  date: number;
};

export type GitProgress = (event: {
  phase: string;
  loaded?: number;
  total?: number;
}) => void;

export const DEFAULT_CORS_PROXY = "https://cors.isomorphic-git.org";

const IDENTITY_KEY = "chatai.git.identity";
export const DEFAULT_GIT_IDENTITY: GitIdentity = {
  name: "Chat AI",
  email: "chat-ai@localhost",
};

export const loadGitIdentity = (): GitIdentity => {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const name = String(parsed?.name ?? "").trim();
      const email = String(parsed?.email ?? "").trim();
      if (name && email) return { name, email };
    }
  } catch {
    // A blocked or unreadable storage is not an error: fall back to the default.
  }
  return { ...DEFAULT_GIT_IDENTITY };
};

export const saveGitIdentity = (identity: GitIdentity) => {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Storage is optional here; the commit still carries the identity.
  }
};

/** Empty disables the proxy; absent uses the public one isomorphic-git ships with. */
export const gitCorsProxy = (): string => {
  const configured = import.meta.env.VITE_GIT_CORS_PROXY;
  if (configured === undefined) return DEFAULT_CORS_PROXY;
  const value = String(configured).trim();
  if (value === "" || value === "false" || value === "none") return "";
  return value;
};

export const usesPublicCorsProxy = (proxy = gitCorsProxy()) =>
  proxy === DEFAULT_CORS_PROXY;

type LoadedGit = {
  git: typeof import("isomorphic-git");
  http: any;
};

let gitPromise: Promise<LoadedGit> | null = null;

export const loadGit = (): Promise<LoadedGit> => {
  if (!gitPromise) {
    gitPromise = (async () => {
      // isomorphic-git's stream reader refuses to run without a global Buffer.
      const { Buffer } = await import("buffer");
      const scope = globalThis as { Buffer?: unknown };
      if (!scope.Buffer) scope.Buffer = Buffer;
      const [{ default: git }, { default: http }] = await Promise.all([
        import("isomorphic-git"),
        // The browser HTTP client. Without it clone, fetch, pull and push have
        // no transport.
        import("isomorphic-git/http/web"),
      ]);
      return { git, http };
    })();
  }
  return gitPromise;
};

/** A typed error whose `code` the dialogs translate. */
export class GitError extends Error {
  constructor(
    readonly code:
      | "UNSUPPORTED_PROVIDER"
      | "READ_ONLY_PROVIDER"
      | "NOT_A_REPOSITORY"
      | "EMPTY_FOLDER"
      | "AUTH_REQUIRED"
      | "PROXY_CREDENTIALS"
      | "EMPTY_COMMIT"
      | "PROVIDER_ERROR",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "GitError";
  }
}

const credentialCache = new Map<string, GitCredentials>();

const repoKey = (provider: FileProvider, basePath: string) =>
  `${provider.sourceId}:${provider.storageId ?? ""}:${basePath}`;

export const rememberGitCredentials = (
  provider: FileProvider,
  basePath: string,
  credentials: GitCredentials,
) => {
  if (credentials?.password) {
    credentialCache.set(repoKey(provider, basePath), { ...credentials });
  }
};

export const forgetGitCredentials = (
  provider: FileProvider,
  basePath: string,
) => {
  credentialCache.delete(repoKey(provider, basePath));
};

export const hasGitCredentials = (
  provider: FileProvider,
  basePath: string,
) => credentialCache.has(repoKey(provider, basePath));

const assertSupported = (provider: FileProvider) => {
  if (!provider.capabilities.read) {
    throw new GitError("READ_ONLY_PROVIDER");
  }
  if (
    !provider.capabilities.write ||
    !provider.capabilities.delete ||
    !provider.capabilities.mkdir
  ) {
    throw new GitError("READ_ONLY_PROVIDER");
  }
};

type Repo = {
  git: typeof import("isomorphic-git");
  http: any;
  fs: GitFs;
  provider: FileProvider;
  basePath: string;
};

const openRepo = async (
  provider: FileProvider,
  basePath: string,
): Promise<Repo> => {
  assertSupported(provider);
  if (provider.status !== "connected") {
    try {
      await provider.connect();
    } catch (error) {
      throw new GitError(
        "PROVIDER_ERROR",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  const { git, http } = await loadGit();
  return {
    git,
    http,
    fs: createProviderGitFs(provider, basePath),
    provider,
    basePath,
  };
};

const dir = "/";

const authOf = (
  provider: FileProvider,
  basePath: string,
  credentials?: GitCredentials,
) => {
  const stored = credentials?.password
    ? credentials
    : credentialCache.get(repoKey(provider, basePath));
  if (!stored?.password) return undefined;
  return () => ({
    username: stored.username?.trim() || "git",
    password: stored.password,
  });
};

const networkOptions = (
  repo: Repo,
  credentials?: GitCredentials,
  onProgress?: GitProgress,
) => {
  const proxy = gitCorsProxy();
  const provided = credentials?.password
    ? credentials
    : credentialCache.get(repoKey(repo.provider, repo.basePath));
  if (provided?.password && usesPublicCorsProxy(proxy)) {
    // The public proxy would see the token. Never send it there.
    throw new GitError("PROXY_CREDENTIALS");
  }
  return {
    fs: repo.fs,
    http: repo.http,
    dir,
    corsProxy: proxy || undefined,
    onAuth: authOf(repo.provider, repo.basePath, credentials),
    onProgress: onProgress
      ? (event: { phase: string; loaded?: number; total?: number }) =>
          onProgress(event)
      : undefined,
  };
};

const describeFailure = (error: unknown): never => {
  if (error instanceof GitError) throw error;
  const statusCode =
    (error as any)?.data?.statusCode ?? (error as any)?.statusCode;
  if (statusCode === 401 || statusCode === 403) {
    throw new GitError("AUTH_REQUIRED");
  }
  if (error instanceof Error) throw error;
  throw new Error(String(error));
};

export const isGitRepository = async (
  provider: FileProvider,
  basePath: string,
): Promise<boolean> => {
  if (!provider.capabilities.read) return false;
  try {
    if (provider.status !== "connected") await provider.connect();
  } catch {
    return false;
  }
  try {
    const entry = await provider.stat(joinPath(basePath, ".git"));
    return entry.kind === "dir";
  } catch {
    return false;
  }
};

export const initGitRepository = async (
  provider: FileProvider,
  basePath: string,
  options: { defaultBranch?: string } = {},
) => {
  const repo = await openRepo(provider, basePath);
  if (await isGitRepository(provider, basePath)) {
    throw new GitError("NOT_A_REPOSITORY", "Already a repository");
  }
  try {
    await repo.git.init({
      fs: repo.fs,
      dir,
      defaultBranch: options.defaultBranch?.trim() || "main",
    });
  } catch (error) {
    return describeFailure(error);
  }
};

const classify = (
  path: string,
  head: number,
  workdir: number,
  stage: number,
): GitFile | null => {
  if (head === 1 && workdir === 1 && stage === 1) return null;
  const base: GitFile = {
    path,
    index: " ",
    worktree: " ",
    untracked: false,
    staged: false,
    unstaged: false,
    deleted: false,
  };
  if (head === 0 && workdir === 2 && stage === 0) {
    return {
      ...base,
      worktree: "?",
      untracked: true,
      unstaged: true,
    };
  }
  if (head === 0 && workdir === 2 && stage === 2) {
    return { ...base, index: "A", staged: true };
  }
  if (head === 0 && workdir === 2 && stage === 3) {
    return {
      ...base,
      index: "A",
      worktree: "M",
      staged: true,
      unstaged: true,
    };
  }
  if (head === 1 && workdir === 2 && stage === 1) {
    return { ...base, worktree: "M", unstaged: true };
  }
  if (head === 1 && workdir === 2 && stage === 2) {
    return { ...base, index: "M", staged: true };
  }
  if (head === 1 && workdir === 2 && stage === 3) {
    return {
      ...base,
      index: "M",
      worktree: "M",
      staged: true,
      unstaged: true,
    };
  }
  if (head === 1 && workdir === 0 && stage === 1) {
    return {
      ...base,
      worktree: "D",
      unstaged: true,
      deleted: true,
    };
  }
  if (head === 1 && workdir === 0 && stage === 0) {
    return {
      ...base,
      index: "D",
      staged: true,
      deleted: true,
    };
  }
  if (head === 1 && workdir === 1 && stage === 0) {
    return {
      ...base,
      index: "D",
      staged: true,
      deleted: true,
    };
  }
  // Present in the worktree only, with a stage entry but no HEAD entry that the
  // table above does not name: treat it as an added, staged file.
  if (head === 0 && stage !== 0) {
    return {
      ...base,
      index: "A",
      worktree: workdir === 2 || workdir === 3 ? "M" : " ",
      staged: true,
      unstaged: workdir === 2 || workdir === 3,
    };
  }
  return null;
};

export const readGitStatus = async (
  provider: FileProvider,
  basePath: string,
): Promise<GitStatus> => {
  const repo = await openRepo(provider, basePath);
  let branch: string | null = null;
  try {
    branch = (await repo.git.currentBranch({ fs: repo.fs, dir })) || null;
    const matrix = await repo.git.statusMatrix({ fs: repo.fs, dir });
    const files: GitFile[] = [];
    for (const [path, head, workdir, stage] of matrix) {
      const file = classify(String(path), head, workdir, stage);
      if (file) files.push(file);
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    return {
      branch,
      detached: !branch,
      files,
      clean: files.length === 0,
    };
  } catch (error) {
    if ((error as any)?.code === "ResolveRefError") {
      // A repository without a commit yet: everything is untracked, and there is
      // no HEAD to compare against. Keep the branch name the unborn HEAD holds.
      return { branch, detached: false, files: [], clean: true };
    }
    return describeFailure(error);
  }
};

export const stageGitFiles = async (
  provider: FileProvider,
  basePath: string,
  paths?: string[],
) => {
  const repo = await openRepo(provider, basePath);
  try {
    if (!paths || paths.length === 0) {
      await repo.git.add({ fs: repo.fs, dir, filepath: "." });
      return;
    }
    for (const path of paths) {
      await repo.git.add({ fs: repo.fs, dir, filepath: path });
    }
  } catch (error) {
    return describeFailure(error);
  }
};

export const unstageGitFiles = async (
  provider: FileProvider,
  basePath: string,
  paths: string[],
) => {
  const repo = await openRepo(provider, basePath);
  try {
    for (const path of paths) {
      await repo.git.resetIndex({ fs: repo.fs, dir, filepath: path });
    }
  } catch (error) {
    return describeFailure(error);
  }
};

/** Throw away worktree changes. Untracked files are deleted; the caller confirms. */
export const discardGitChanges = async (
  provider: FileProvider,
  basePath: string,
  files: GitFile[],
) => {
  const repo = await openRepo(provider, basePath);
  const tracked = files.filter((file) => !file.untracked);
  const untracked = files.filter((file) => file.untracked);
  try {
    for (const file of tracked) {
      // Restore from the index, which is what `git restore` does for a worktree
      // change: staged content of an `MM` file must survive.
      await repo.git.checkout({
        fs: repo.fs,
        dir,
        filepaths: [file.path],
        force: true,
        noUpdateHead: true,
      });
    }
    for (const file of untracked) {
      await provider.remove(joinPath(basePath, file.path), {
        recursive: false,
      });
    }
  } catch (error) {
    return describeFailure(error);
  }
};

export const commitGitChanges = async (
  provider: FileProvider,
  basePath: string,
  options: { message: string; identity: GitIdentity },
) => {
  const message = options.message.trim();
  if (!message) throw new GitError("EMPTY_COMMIT");
  const repo = await openRepo(provider, basePath);
  try {
    await repo.git.setConfig({
      fs: repo.fs,
      dir,
      path: "user.name",
      value: options.identity.name,
    });
    await repo.git.setConfig({
      fs: repo.fs,
      dir,
      path: "user.email",
      value: options.identity.email,
    });
    const now = Date.now();
    const oid = await repo.git.commit({
      fs: repo.fs,
      dir,
      message,
      author: {
        name: options.identity.name,
        email: options.identity.email,
        timestamp: Math.floor(now / 1000),
        timezoneOffset: new Date(now).getTimezoneOffset(),
      },
    });
    saveGitIdentity(options.identity);
    return oid;
  } catch (error) {
    if ((error as any)?.code === "EmptyCommitError") {
      throw new GitError("EMPTY_COMMIT");
    }
    return describeFailure(error);
  }
};

export const readGitLog = async (
  provider: FileProvider,
  basePath: string,
  depth = 30,
): Promise<GitCommit[]> => {
  const repo = await openRepo(provider, basePath);
  try {
    const entries = await repo.git.log({ fs: repo.fs, dir, depth });
    return entries.map((entry: any) => ({
      oid: entry.oid,
      message: String(entry.commit?.message ?? "").trim(),
      author: entry.commit?.author?.name ?? "",
      email: entry.commit?.author?.email ?? "",
      date:
        typeof entry.commit?.author?.timestamp === "number"
          ? entry.commit.author.timestamp * 1000
          : Date.now(),
    }));
  } catch (error) {
    if ((error as any)?.code === "ResolveRefError") return [];
    return describeFailure(error);
  }
};

export const listGitBranches = async (
  provider: FileProvider,
  basePath: string,
): Promise<GitBranchInfo> => {
  const repo = await openRepo(provider, basePath);
  try {
    const local = await repo.git.listBranches({ fs: repo.fs, dir });
    let remote: string[] = [];
    try {
      const remotes = await repo.git.listBranches({
        fs: repo.fs,
        dir,
        remote: "origin",
      });
      remote = remotes.map((name: string) => `origin/${name}`);
    } catch {
      remote = [];
    }
    const current = await repo.git.currentBranch({ fs: repo.fs, dir });
    return { local, remote, current: current || null };
  } catch (error) {
    return describeFailure(error);
  }
};

export const createGitBranch = async (
  provider: FileProvider,
  basePath: string,
  name: string,
  options: { checkout?: boolean } = {},
) => {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("A branch name is required");
  const repo = await openRepo(provider, basePath);
  try {
    await repo.git.branch({ fs: repo.fs, dir, ref: trimmed });
    if (options.checkout) {
      await repo.git.checkout({ fs: repo.fs, dir, ref: trimmed });
    }
  } catch (error) {
    return describeFailure(error);
  }
};

export const checkoutGitBranch = async (
  provider: FileProvider,
  basePath: string,
  ref: string,
) => {
  const repo = await openRepo(provider, basePath);
  try {
    const local = await repo.git.listBranches({ fs: repo.fs, dir });
    if (local.includes(ref)) {
      await repo.git.checkout({ fs: repo.fs, dir, ref });
    } else {
      await repo.git.checkout({
        fs: repo.fs,
        dir,
        ref: ref.replace(/^origin\//, ""),
        remote: "origin",
        track: true,
      });
    }
  } catch (error) {
    return describeFailure(error);
  }
};

export const deleteGitBranch = async (
  provider: FileProvider,
  basePath: string,
  ref: string,
) => {
  const repo = await openRepo(provider, basePath);
  try {
    await repo.git.deleteBranch({ fs: repo.fs, dir, ref });
  } catch (error) {
    return describeFailure(error);
  }
};

export const listGitRemotes = async (
  provider: FileProvider,
  basePath: string,
): Promise<GitRemote[]> => {
  const repo = await openRepo(provider, basePath);
  try {
    const remotes = await repo.git.listRemotes({ fs: repo.fs, dir });
    return remotes.map((remote: any) => ({
      name: String(remote.remote),
      url: String(remote.url),
    }));
  } catch (error) {
    return describeFailure(error);
  }
};

export const setGitRemote = async (
  provider: FileProvider,
  basePath: string,
  options: { name?: string; url: string; remove?: boolean },
) => {
  const repo = await openRepo(provider, basePath);
  const name = options.name?.trim() || "origin";
  try {
    if (options.remove) {
      await repo.git.deleteRemote({ fs: repo.fs, dir, remote: name });
      return;
    }
    const url = options.url.trim();
    if (!url) throw new Error("A repository URL is required");
    const existing = await repo.git
      .listRemotes({ fs: repo.fs, dir })
      .then((remotes: any[]) => remotes.some((item) => item.remote === name));
    if (existing) {
      await repo.git.setConfig({
        fs: repo.fs,
        dir,
        path: `remote.${name}.url`,
        value: url,
      });
    } else {
      await repo.git.addRemote({ fs: repo.fs, dir, remote: name, url });
    }
  } catch (error) {
    return describeFailure(error);
  }
};

export const fetchGitRemote = async (
  provider: FileProvider,
  basePath: string,
  options: { credentials?: GitCredentials; onProgress?: GitProgress } = {},
) => {
  const repo = await openRepo(provider, basePath);
  try {
    await repo.git.fetch({
      ...networkOptions(repo, options.credentials, options.onProgress),
      remote: "origin",
    });
  } catch (error) {
    return describeFailure(error);
  }
};

const identityAuthor = (identity: GitIdentity) => {
  const now = Date.now();
  return {
    name: identity.name,
    email: identity.email,
    timestamp: Math.floor(now / 1000),
    timezoneOffset: new Date(now).getTimezoneOffset(),
  };
};

export const pullGitRemote = async (
  provider: FileProvider,
  basePath: string,
  options: {
    credentials?: GitCredentials;
    identity?: GitIdentity;
    onProgress?: GitProgress;
  } = {},
) => {
  const repo = await openRepo(provider, basePath);
  const identity = options.identity ?? loadGitIdentity();
  try {
    await repo.git.pull({
      ...networkOptions(repo, options.credentials, options.onProgress),
      remote: "origin",
      author: identityAuthor(identity),
      fastForward: true,
    });
  } catch (error) {
    return describeFailure(error);
  }
};

export const pushGitRemote = async (
  provider: FileProvider,
  basePath: string,
  options: {
    credentials?: GitCredentials;
    ref?: string;
    setUpstream?: boolean;
    onProgress?: GitProgress;
  } = {},
) => {
  const repo = await openRepo(provider, basePath);
  try {
    const ref =
      options.ref ??
      (await repo.git.currentBranch({ fs: repo.fs, dir })) ??
      undefined;
    await repo.git.push({
      ...networkOptions(repo, options.credentials, options.onProgress),
      remote: "origin",
      ref,
      force: false,
    });
    if (options.setUpstream !== false && ref) {
      await repo.git.setConfig({
        fs: repo.fs,
        dir,
        path: `branch.${ref}.remote`,
        value: "origin",
      });
      await repo.git.setConfig({
        fs: repo.fs,
        dir,
        path: `branch.${ref}.merge`,
        value: `refs/heads/${ref}`,
      });
    }
  } catch (error) {
    if ((error as any)?.code === "PushRejectedError") {
      throw new Error(
        "The remote rejected the push. Pull the remote changes first.",
      );
    }
    return describeFailure(error);
  }
};

export const cloneGitRepository = async (
  provider: FileProvider,
  basePath: string,
  options: {
    url: string;
    ref?: string;
    shallow?: boolean;
    credentials?: GitCredentials;
    onProgress?: GitProgress;
  },
) => {
  const url = String(options.url ?? "").trim();
  if (!url) throw new Error("A repository URL is required");
  const repo = await openRepo(provider, basePath);
  const existing = await provider.list(basePath);
  if (existing.entries.length > 0) throw new GitError("EMPTY_FOLDER");
  try {
    await repo.git.clone({
      ...networkOptions(repo, options.credentials, options.onProgress),
      url,
      ref: options.ref?.trim() || undefined,
      singleBranch: Boolean(options.ref?.trim()),
      depth: options.shallow ? 1 : undefined,
    });
    if (options.credentials?.password) {
      rememberGitCredentials(provider, basePath, options.credentials);
    }
  } catch (error) {
    return describeFailure(error);
  }
};
