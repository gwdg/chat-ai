import { readAll, streamOf } from "../bytes";
import { baseName, joinPath } from "../paths";
import type { FileProvider } from "../providers/types";
import { WorkspaceError } from "../providers/types";

/**
 * A Node-style `fs` on top of a workspace `FileProvider`.
 *
 * isomorphic-git is given `dir = "/"` and a git directory at `/.git`. Every path
 * it hands to the filesystem is therefore absolute and repo-relative, and this
 * adapter prefixes the provider path of the folder the repository lives in. The
 * same Git client then runs over browser storage, a picked local folder and
 * saia-fs without any of them knowing about Git.
 *
 * Git probes `readFile()` with no arguments to tell a promise API from a
 * callback one, so every method has to be async. It never calls `rename` or
 * `chmod`, only the operations below (see `bindFs` in isomorphic-git).
 */

type GitStats = {
  type: "file" | "dir";
  mode: number;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  dev: number;
  ino: number;
  uid: number;
  gid: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
};

export type GitFs = {
  readFile(path: string, options?: unknown): Promise<Uint8Array | string>;
  writeFile(
    path: string,
    data: Uint8Array | string,
    options?: unknown,
  ): Promise<void>;
  unlink(path: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string, options?: unknown): Promise<void>;
  rmdir(path: string, options?: unknown): Promise<void>;
  stat(path: string): Promise<GitStats>;
  lstat(path: string): Promise<GitStats>;
  readlink(path: string): Promise<never>;
  symlink(): Promise<never>;
};

const FILE_MODE = 0o100644;
const DIR_MODE = 0o40000;

/** Stable per-path inode, so `compareStats` does not treat every call as a new file. */
const inoOf = (path: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < path.length; i += 1) {
    hash ^= path.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
};

type NodeError = Error & {
  code?: string;
  errno?: string;
  syscall?: string;
  path?: string;
};

const nodeError = (
  code: string,
  syscall: string,
  path: string,
  extra?: Record<string, unknown>,
): NodeError => {
  const error = new Error(`${code}: ${syscall}, '${path}'`) as NodeError;
  error.code = code;
  error.errno = code;
  error.syscall = syscall;
  error.path = path;
  Object.assign(error, extra);
  return error;
};

const mapError = (
  error: unknown,
  syscall: string,
  path: string,
): NodeError => {
  // A `WorkspaceError` carries its own `code`, so it has to be classified before
  // the generic pass-through, or Git would see "NOT_FOUND" instead of ENOENT.
  if (error instanceof WorkspaceError) {
    switch (error.code) {
      case "NOT_FOUND":
        return nodeError("ENOENT", syscall, path);
      case "CONFLICT":
        return nodeError("EEXIST", syscall, path);
      case "PERMISSION_DENIED":
        return nodeError("EACCES", syscall, path);
      case "UNSUPPORTED":
        return nodeError("ENOSYS", syscall, path);
      default:
        return nodeError("EIO", syscall, path, {
          message: `${error.code}: ${syscall}, '${path}': ${error.message}`,
        });
    }
  }
  if (error && (error as NodeError).code) {
    return error as NodeError;
  }
  const message = error instanceof Error ? error.message : String(error);
  return nodeError("EIO", syscall, path, {
    message: `${syscall}, '${path}': ${message}`,
  });
};

const statsFor = (
  path: string,
  entry: { kind: "file" | "dir"; size?: number; mtime?: string },
): GitStats => {
  const parsed = entry.mtime ? Date.parse(entry.mtime) : Number.NaN;
  const mtimeMs = Number.isFinite(parsed) ? parsed : Date.now();
  const isFile = entry.kind === "file";
  return {
    type: isFile ? "file" : "dir",
    mode: isFile ? FILE_MODE : DIR_MODE,
    size: isFile ? (entry.size ?? 0) : 0,
    mtimeMs,
    ctimeMs: mtimeMs,
    dev: 1,
    ino: inoOf(path),
    uid: 0,
    gid: 0,
    isFile: () => isFile,
    isDirectory: () => !isFile,
    isSymbolicLink: () => false,
  };
};

const isMissing = (error: unknown) =>
  error instanceof WorkspaceError && error.code === "NOT_FOUND";

/**
 * @param provider the source that holds the folder
 * @param basePath provider-relative path of the folder that is the repo root
 */
export function createProviderGitFs(
  provider: FileProvider,
  basePath = "/",
): GitFs {
  const toProviderPath = (path: string) => joinPath(basePath, path);

  const ensure = async () => {
    if (provider.status !== "connected") {
      try {
        await provider.connect();
      } catch (error) {
        throw mapError(error, "connect", basePath);
      }
    }
  };

  const fs: GitFs = {
    async readFile(path, options) {
      await ensure();
      const encoding =
        typeof options === "string"
          ? options
          : (options as { encoding?: string } | undefined)?.encoding;
      const entry = await provider
        .stat(toProviderPath(path))
        .catch((error) => {
          throw mapError(error, "open", path);
        });
      if (entry.kind === "dir") {
        throw nodeError("EISDIR", "read", path);
      }
      let bytes: Uint8Array;
      try {
        bytes = await readAll(await provider.read(toProviderPath(path)));
      } catch (error) {
        throw mapError(error, "read", path);
      }
      if (encoding && encoding !== "buffer") {
        return new TextDecoder("utf-8").decode(bytes);
      }
      return bytes;
    },

    async writeFile(path, data) {
      await ensure();
      const bytes =
        typeof data === "string" ? new TextEncoder().encode(data) : data;
      try {
        await provider.write(toProviderPath(path), streamOf(bytes), {
          size: bytes.byteLength,
          overwrite: true,
        });
      } catch (error) {
        throw mapError(error, "write", path);
      }
    },

    async unlink(path) {
      await ensure();
      try {
        await provider.remove(toProviderPath(path), { recursive: false });
      } catch (error) {
        if (isMissing(error)) throw nodeError("ENOENT", "unlink", path);
        throw mapError(error, "unlink", path);
      }
    },

    async readdir(path) {
      await ensure();
      const names: string[] = [];
      let cursor: string | undefined;
      let failure: unknown = null;
      try {
        do {
          const page = await provider.list(toProviderPath(path), cursor);
          for (const entry of page.entries) {
            names.push(entry.name || baseName(entry.path));
          }
          cursor = page.next;
        } while (cursor);
      } catch (error) {
        failure = error;
      }
      // An answer can be empty — or fail as "not found" — because the path is a
      // file: browsers and the SAIA filesystem list a file as nothing, and some
      // providers report it as missing. Git understands ENOTDIR, so check the
      // one case that distinguishes a file from a missing directory.
      if (failure || names.length === 0) {
        let entry: Awaited<ReturnType<FileProvider["stat"]>> | null = null;
        try {
          entry = await provider.stat(toProviderPath(path));
        } catch {
          entry = null;
        }
        if (entry?.kind === "file") {
          throw nodeError("ENOTDIR", "scandir", path);
        }
        if (failure) {
          if (isMissing(failure)) throw nodeError("ENOENT", "scandir", path);
          throw mapError(failure, "scandir", path);
        }
      }
      return names;
    },

    async mkdir(path) {
      await ensure();
      const target = toProviderPath(path);
      let exists = false;
      try {
        const entry = await provider.stat(target);
        exists = entry.kind === "dir";
      } catch {
        exists = false;
      }
      if (exists) throw nodeError("EEXIST", "mkdir", path);
      try {
        await provider.mkdir(target);
      } catch (error) {
        // A provider that reports an existing directory as a conflict is right.
        if (error instanceof WorkspaceError && error.code === "CONFLICT") {
          throw nodeError("EEXIST", "mkdir", path);
        }
        throw mapError(error, "mkdir", path);
      }
    },

    async rmdir(path, options) {
      await ensure();
      const recursive = Boolean(
        (options as { recursive?: boolean } | undefined)?.recursive,
      );
      try {
        await provider.remove(toProviderPath(path), { recursive });
      } catch (error) {
        if (error instanceof WorkspaceError && error.code === "CONFLICT") {
          throw nodeError("ENOTEMPTY", "rmdir", path);
        }
        if (isMissing(error)) throw nodeError("ENOENT", "rmdir", path);
        throw mapError(error, "rmdir", path);
      }
    },

    async stat(path) {
      await ensure();
      try {
        const entry = await provider.stat(toProviderPath(path));
        return statsFor(path, entry);
      } catch (error) {
        throw mapError(error, "stat", path);
      }
    },

    async lstat(path) {
      return fs.stat(path);
    },

    async readlink(path) {
      throw nodeError("ENOSYS", "readlink", path);
    },

    async symlink(path) {
      throw nodeError("ENOSYS", "symlink", String(path));
    },
  };

  return fs;
}
