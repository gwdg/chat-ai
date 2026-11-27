import { joinPath } from "./paths";
import type { FileProvider } from "./providers/types";

export interface UploadOptions {
  /** Replace a file that is already there instead of reporting a conflict. */
  overwrite?: boolean;
  /**
   * Bytes the provider accepted for `file`, reported once at `0` before the
   * write starts and then whenever the provider reports progress. A provider
   * that does not report any progress simply never calls it again.
   */
  onProgress?: (file: File, sent: number, total: number) => void;
}

/** Write local files into a provider directory; a failed file does not stop the others. */
export async function uploadLocalFiles(
  provider: FileProvider,
  directory: string,
  files: File[],
  onError?: (file: File, error: unknown) => void,
  options: UploadOptions = {},
): Promise<number> {
  let uploaded = 0;
  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
      // The first report lands before the request leaves, so a dropped file
      // shows which one is moving instead of sitting on a still pane.
      options.onProgress?.(file, 0, file.size);
      await provider.write(joinPath(directory, file.name), stream, {
        size: file.size,
        overwrite: options.overwrite ?? false,
        ...(options.onProgress
          ? {
              onProgress: (sent: number, total: number) =>
                options.onProgress?.(file, sent, total || file.size),
            }
          : {}),
      });
      uploaded += 1;
    } catch (error) {
      onError?.(file, error);
    }
  }
  return uploaded;
}
