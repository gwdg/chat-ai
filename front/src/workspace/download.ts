import type { WorkspaceFileEntry } from "../db/dbTypes";
import { downloadBlob } from "../utils/download";
import type { FileProvider } from "./providers/types";

/** Read every chunk of a provider stream into one buffer. */
export const readAll = async (
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> => {
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
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
};

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
