import { useFile, useFileBase64, useFileContent, useFileMeta } from "../db";
import { getFileType } from "../utils/attachments";

// Types that are rendered from bytes. Everything else renders from decoded text.
const MEDIA_TYPES = new Set(["image", "video", "audio", "pdf"]);

/**
 * Turns a stored conversation file into the same descriptor the workspace and agent
 * providers hand to `FilePreviewPanel`, so chat attachments render through the shared
 * preview instead of a second implementation.
 */
export function useConversationFilePreview(fileId, fallbackName) {
  const id = fileId ?? "";
  const meta = useFileMeta(id);
  const { data } = useFile(id);
  const url = useFileBase64(id);
  const text = useFileContent(id);

  const name = meta?.name ?? fallbackName ?? "";
  const mime = meta?.type;
  const kind = getFileType({ type: mime, name });
  const needsUrl = MEDIA_TYPES.has(kind);

  return {
    entry: { name, mime, size: meta?.size },
    // Binary content must never reach the text renderer: handing bytes to a <pre>
    // shows mojibake, and handing decoded text to <img> produced "Failed to load image".
    url: needsUrl ? url : undefined,
    text: needsUrl ? undefined : text,
    data: kind === "docx" ? data : undefined,
    loaded: Boolean(meta),
    loading: false,
  };
}
