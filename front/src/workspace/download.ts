import type { WorkspaceFileEntry } from "../db/dbTypes";
import { downloadBlob } from "../utils/download";
import { resolveMimeType } from "../utils/mime";
import { readAll } from "./bytes";
import type { FileProvider } from "./providers/types";

export { readAll } from "./bytes";

/** One provider entry and the provider it lives in, as a batch download needs both. */
export type ProviderDownload = {
  provider: FileProvider;
  entry: WorkspaceFileEntry;
};

/** A file the batch could not save, named so the UI can say which one it was. */
export type ProviderDownloadFailure = {
  name: string;
  message: string;
};

type DirectoryPickerWindow = {
  showDirectoryPicker?: (options: {
    mode: "read" | "readwrite";
  }) => Promise<FileSystemDirectoryHandle>;
};

const pickerFrom = (target: unknown): DirectoryPickerWindow["showDirectoryPicker"] =>
  (target as DirectoryPickerWindow | undefined)?.showDirectoryPicker;

/**
 * Whether the browser can be asked for a destination folder. The dialog is only available in a
 * secure context, so a plain `http://` page falls back to one download per file.
 */
export function canPickDownloadDirectory(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof pickerFrom(window) === "function"
  );
}

/**
 * Ask for the folder several files should be saved into. Returns `null` when the user cancels the
 * picker: a cancelled prompt is a cancelled download, not a reason to save the files somewhere
 * else.
 */
export async function pickDownloadDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const picker = pickerFrom(window);
  if (!picker) return null;
  try {
    return await picker.call(window, { mode: "readwrite" });
  } catch (reason) {
    if ((reason as { name?: string } | null)?.name === "AbortError") return null;
    throw reason;
  }
}

/**
 * Save a workspace entry to the user's disk. The complete content is read before the download
 * starts, so a streaming provider or one that is still connecting cannot produce an empty file.
 */
export async function downloadProviderEntry(
  provider: FileProvider,
  entry: WorkspaceFileEntry,
): Promise<void> {
  if (entry.kind !== "file") return;
  if (provider.status !== "connected") await provider.connect();
  const bytes = await readAll(await provider.read(entry.path));
  downloadBlob(
    new Blob([bytes as Uint8Array<ArrayBuffer>], {
      type: resolveMimeType(entry.name, entry.mime) || "application/octet-stream",
    }),
    entry.name,
  );
}

/** A file already at the destination, or a folder of that name, must not be overwritten. */
async function nameTaken(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<boolean> {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch (reason) {
    if ((reason as { name?: string } | null)?.name === "NotFoundError") {
      return false;
    }
    // A directory of that name also blocks the file; anything else is treated
    // as taken rather than risking an overwrite.
    return true;
  }
}

/** `report.pdf` → `report (2).pdf`, never the same name twice in one batch. */
function numberedName(name: string, attempt: number): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name} (${attempt})`;
  return `${name.slice(0, dot)} (${attempt})${name.slice(dot)}`;
}

async function freeName(
  directory: FileSystemDirectoryHandle,
  name: string,
  taken: Set<string>,
): Promise<string> {
  for (let attempt = 1; attempt < 1000; attempt += 1) {
    const candidate = attempt === 1 ? name : numberedName(name, attempt);
    if (!taken.has(candidate) && !(await nameTaken(directory, candidate))) {
      return candidate;
    }
  }
  throw new Error(`No free file name for “${name}” in this folder.`);
}

/**
 * Write a set of workspace files into a folder the user picked. The browser's own download dialog
 * cannot take a destination folder, so a set goes through the File System Access API one file at
 * a time; an existing file is never overwritten, and one failure does not stop the rest.
 */
export async function saveProviderEntriesToDirectory(
  directory: FileSystemDirectoryHandle,
  items: ProviderDownload[],
): Promise<ProviderDownloadFailure[]> {
  const failures: ProviderDownloadFailure[] = [];
  const taken = new Set<string>();

  for (const { provider, entry } of items) {
    if (entry.kind !== "file") continue;
    try {
      if (provider.status !== "connected") await provider.connect();
      const bytes = await readAll(await provider.read(entry.path));
      const name = await freeName(directory, entry.name, taken);
      taken.add(name);
      const handle = await directory.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      try {
        await writable.write(bytes as Uint8Array<ArrayBuffer>);
        await writable.close();
      } catch (reason) {
        // Closing after a failed write would commit half a file.
        await writable.abort?.().catch(() => {});
        throw reason;
      }
    } catch (reason) {
      failures.push({
        name: entry.name,
        message: reason instanceof Error ? reason.message : String(reason),
      });
    }
  }

  return failures;
}
