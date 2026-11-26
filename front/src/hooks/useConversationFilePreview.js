import { useEffect, useState } from "react";

import { useFile, useFileContent, useFileMeta } from "../db";
import { getFileType } from "../utils/attachments";

// Types that are rendered from bytes. Everything else renders from decoded text.
const MEDIA_TYPES = new Set(["image", "video", "audio", "pdf"]);

/**
 * Chrome caps a URL at 2 MB, and base64 inflates the bytes by a third, so the
 * `data:` URL these previews used to build was silently rejected for any attachment
 * above ~1.5 MB: a 12 MB PDF rendered as an empty frame. An object URL has no such
 * limit, and it is what the workspace and agent previews already hand over.
 */
function useObjectUrl(bytes, mime) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!bytes) {
      setUrl(null);
      return undefined;
    }
    const blob = new Blob([bytes], { type: mime || "application/octet-stream" });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [bytes, mime]);
  return url;
}

/**
 * Turns a stored conversation file into the same descriptor the workspace and agent
 * providers hand to `FilePreviewPanel`, so chat attachments render through the shared
 * preview instead of a second implementation.
 */
export function useConversationFilePreview(fileId, fallbackName) {
  const id = fileId ?? "";
  const meta = useFileMeta(id);
  const { data } = useFile(id);
  const text = useFileContent(id);

  const name = meta?.name ?? fallbackName ?? "";
  const mime = meta?.type;
  const kind = getFileType({ type: mime, name });
  const needsUrl = MEDIA_TYPES.has(kind);
  // Only media needs the bytes as a URL; a text preview decodes them itself.
  const url = useObjectUrl(needsUrl ? data : null, mime);

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
