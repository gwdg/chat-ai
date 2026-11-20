import type { WorkspaceFileEntry } from "../db/dbTypes";
import { downloadBlob } from "../utils/download";
import { readAll } from "./bytes";
import type { FileProvider } from "./providers/types";

export { readAll } from "./bytes";

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
      type: entry.mime || "application/octet-stream",
    }),
    entry.name,
  );
}
