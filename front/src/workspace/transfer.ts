import { newId } from "../db";
import type { WorkspaceFileEntry } from "../db/dbTypes";
import { saveTransfer } from "../db/workspaceDb";
import { baseName, joinPath, normalizePath } from "./paths";
import type { FileProvider } from "./providers/types";
import { WorkspaceError } from "./providers/types";

export type TransferProgress = {
  copiedBytes: number;
  totalBytes: number;
  currentPath?: string;
};

export type RunTransferInput = {
  workspaceId: string;
  from: FileProvider;
  to: FileProvider;
  entry: WorkspaceFileEntry;
  targetDir: string;
  strategy: "copy" | "move";
  onProgress?: (progress: TransferProgress) => void;
  signal?: AbortSignal;
};

const readAll = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      length += value.length;
    }
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const part of chunks) {
    data.set(part, offset);
    offset += part.length;
  }
  return data;
};

const streamOf = (data: Uint8Array): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

const digest = async (data: Uint8Array): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const findAvailableName = async (
  provider: FileProvider,
  dir: string,
  name: string,
): Promise<string> => {
  const candidate = (suffix: number) => {
    if (!suffix) return name;
    const dot = name.lastIndexOf(".");
    if (dot > 0) return `${name.slice(0, dot)} (${suffix})${name.slice(dot)}`;
    return `${name} (${suffix})`;
  };
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const path = joinPath(dir, candidate(suffix));
    try {
      await provider.stat(path);
    } catch (error) {
      if (error instanceof WorkspaceError && error.code === "NOT_FOUND") {
        return candidate(suffix);
      }
      throw error;
    }
  }
  throw new WorkspaceError("CONFLICT");
};

const collectFiles = async (
  provider: FileProvider,
  entry: WorkspaceFileEntry,
): Promise<{ files: WorkspaceFileEntry[]; dirs: WorkspaceFileEntry[] }> => {
  if (entry.kind === "file") return { files: [entry], dirs: [] };
  const files: WorkspaceFileEntry[] = [];
  const dirs: WorkspaceFileEntry[] = [entry];
  let cursor: string | undefined;
  do {
    const page = await provider.list(entry.path, cursor);
    for (const child of page.entries) {
      if (child.kind === "dir") {
        const nested = await collectFiles(provider, child);
        files.push(...nested.files);
        dirs.push(...nested.dirs);
      } else {
        files.push(child);
      }
    }
    cursor = page.next;
  } while (cursor);
  return { files, dirs };
};

export async function runTransfer(input: RunTransferInput) {
  const { workspaceId, from, to, entry, targetDir, strategy, onProgress, signal } =
    input;
  const { files, dirs } = await collectFiles(from, entry);
  const totalBytes = files.reduce((sum, file) => sum + (file.size ?? 0), 0);
  const job = {
    id: newId(),
    workspaceId,
    fromSourceId: from.sourceId,
    toSourceId: to.sourceId,
    fromPath: entry.path,
    toPath: targetDir,
    intent: strategy,
    status: "running" as const,
    totalBytes,
    copiedBytes: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveTransfer(job);

  let copiedBytes = 0;
  try {
    for (const dir of dirs) {
      const relative = dir.path.slice(normalizePath(entry.path).length);
      await to.mkdir(joinPath(targetDir, relative || ""));
    }

    for (const file of files) {
      if (signal?.aborted) throw new WorkspaceError("CANCELLED");
      const relative = file.path.slice(normalizePath(entry.path).length);
      const targetName = await findAvailableName(
        to,
        joinPath(targetDir, relative.split("/").slice(0, -1).join("/")),
        baseName(file.path),
      );
      const targetPath = joinPath(
        targetDir,
        relative.split("/").slice(0, -1).join("/"),
        targetName,
      );
      const sourceBytes = await readAll(await from.read(file.path));
      const written = await to.write(targetPath, streamOf(sourceBytes), {
        size: sourceBytes.length,
        overwrite: false,
      });
      const targetBytes = await readAll(await to.read(written.path));
      if ((await digest(sourceBytes)) !== (await digest(targetBytes))) {
        throw new WorkspaceError("PROVIDER_ERROR", "Copy verification failed");
      }
      if (strategy === "move") {
        await from.remove(file.path, { recursive: false });
      }
      copiedBytes += sourceBytes.length;
      onProgress?.({ copiedBytes, totalBytes, currentPath: file.path });
      await saveTransfer({ ...job, copiedBytes });
    }

    if (strategy === "move" && entry.kind === "dir") {
      for (const dir of [...dirs].sort((a, b) => b.path.length - a.path.length)) {
        await from.remove(dir.path, { recursive: true });
      }
    }

    await saveTransfer({
      ...job,
      status: "done",
      copiedBytes,
      totalBytes,
    });
  } catch (error) {
    const code = error instanceof WorkspaceError ? error.code : "PROVIDER_ERROR";
    await saveTransfer({
      ...job,
      status: code === "CANCELLED" ? "cancelled" : "failed",
      copiedBytes,
      totalBytes,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
