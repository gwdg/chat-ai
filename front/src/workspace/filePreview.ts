import { getFileType } from "../utils/attachments";
import { readAll } from "./bytes";
import type { FileProvider, ProviderEntry } from "./providers/types";

/** Files larger than this are never read for a preview. */
export const PREVIEW_LIMIT_BYTES = 25 * 1024 * 1024;

/**
 * The largest file the editor opens. A bigger text file keeps the plain `<pre>`
 * preview: CodeMirror holds the whole document in memory, and past a few hundred
 * kilobytes the syntax tree costs more than the file is worth editing by hand.
 */
export const MAX_EDIT_BYTES = 512 * 1024;

/** What the Files tree asks a preview pane to show for one row. */
export type FilePreviewRequest = {
  entry: { name: string; mime?: string; size?: number };
  /**
   * Identity of this open, so the pane can remount per request: two files may
   * share a name, and a re-opened file must not inherit the previous view's state.
   */
  key?: string;
  /** Object URL for binary/media kinds; revoked through `release`. */
  url?: string;
  /** Decoded text for text-like kinds. */
  text?: string;
  /** True while the bytes are still being read. */
  loading?: boolean;
  /** Plain message when the file cannot be shown. */
  error?: string;
  /** Revokes `url`; the caller calls it when it replaces or closes the preview. */
  release?: () => void;
  /**
   * Present when the file may be shown in the editor. `readOnly` follows the
   * source (a read-only mount, a chat attachment); `save` only exists when the
   * provider reported write access, so a read-only file cannot be written even
   * by calling it.
   */
  editor?: {
    /** Identifies the draft across files; workspace + source + provider path. */
    draftKey: string;
    readOnly: boolean;
    /** Writes the text through the provider and resolves with the new size. */
    save?: (text: string) => Promise<number>;
  };
};

export type ProviderPreview =
  | {
      entry: ProviderEntry;
      url?: string;
      text?: string;
      release?: () => void;
    }
  | { entry: ProviderEntry; error: string };

const BINARY_KINDS = new Set([
  "image",
  "video",
  "audio",
  "pdf",
  "docx",
  "excel",
]);

const plainError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Reads one provider entry and returns what a preview pane can render: an
 * object URL for media/binary kinds, decoded text for text-like kinds, or a
 * plain error. The caller owns the returned `release`.
 */
export async function readProviderPreview(
  provider: FileProvider,
  entry: ProviderEntry,
): Promise<ProviderPreview> {
  if (entry.kind !== "file") {
    return { entry, error: "not a file" };
  }
  if (typeof entry.size === "number" && entry.size > PREVIEW_LIMIT_BYTES) {
    return { entry, error: "File is too large to preview" };
  }

  let bytes: Uint8Array;
  try {
    bytes = await readAll(await provider.read(entry.path));
  } catch (error) {
    return { entry, error: plainError(error) };
  }

  const mime = entry.mime;
  const kind = getFileType({ type: mime, name: entry.name });
  const shown = { ...entry, mime, size: bytes.byteLength };

  if (BINARY_KINDS.has(kind)) {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const blob = new Blob([buffer], {
      type: mime || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    return {
      entry: shown,
      url,
      release: () => URL.revokeObjectURL(url),
    };
  }

  if (bytes.includes(0)) {
    return { entry, error: "This file cannot be previewed" };
  }
  return { entry: shown, text: new TextDecoder().decode(bytes) };
}
