import { joinPath } from "./paths";
import type { FileProvider } from "./providers/types";

/** Write local files into a provider directory; a failed file does not stop the others. */
export async function uploadLocalFiles(
  provider: FileProvider,
  directory: string,
  files: File[],
  onError?: (file: File, error: unknown) => void,
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
      await provider.write(joinPath(directory, file.name), stream, {
        size: file.size,
        overwrite: false,
      });
      uploaded += 1;
    } catch (error) {
      onError?.(file, error);
    }
  }
  return uploaded;
}
