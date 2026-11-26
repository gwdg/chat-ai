import { getFileType } from "../utils/attachments";
import { resolveMimeType } from "../utils/mime";
import { downloadProviderEntry } from "./download";
import { readAll } from "./bytes";
import { joinPath, parentPath } from "./paths";
import type { FileProvider, ProviderEntry } from "./providers/types";

/** Files larger than this are never read for a preview. */
export const PREVIEW_LIMIT_BYTES = 25 * 1024 * 1024;

const IMAGE_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

const imageMime = (name: string): string => {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return IMAGE_MIME[ext] ?? "application/octet-stream";
};

/**
 * Resolve `![](bild.png)` next to a markdown file. A bare or relative path is
 * read through the same provider, so a picture in the same collection or folder
 * shows up in the preview; an absolute URL, a data URL or an external reference
 * is left to the renderer's own policy.
 */
const markdownImageResolver = (provider: FileProvider, entry: ProviderEntry) => {
  const urls = new Set<string>();
  const resolve = async (src: string): Promise<string | null> => {
    const raw = String(src ?? "").trim();
    if (!raw) return null;
    if (
      raw.startsWith("data:") ||
      raw.startsWith("#") ||
      raw.startsWith("//") ||
      /^[a-z][a-z0-9+.-]*:/i.test(raw)
    ) {
      return null;
    }
    let relative = raw.split("#")[0].split("?")[0];
    try {
      relative = decodeURIComponent(relative);
    } catch {
      // keep the raw value
    }
    relative = relative.replace(/^\.\//, "");
    if (relative.startsWith("/")) relative = relative.replace(/^\/+/, "");
    if (!relative) return null;
    const target = joinPath(parentPath(entry.path), relative);
    try {
      const bytes = await readAll(await provider.read(target));
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      const url = URL.createObjectURL(
        new Blob([buffer], { type: imageMime(target) }),
      );
      urls.add(url);
      return url;
    } catch {
      return null;
    }
  };
  return {
    resolve,
    release: () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
};

/** What the Files tree asks a preview pane to show for one row. */
export type FilePreviewRequest = {
  entry: { name: string; mime?: string; size?: number };
  /** Object URL for binary/media kinds; revoked through `release`. */
  url?: string;
  /** Decoded text for text-like kinds. */
  text?: string;
  /** Resolves a relative image reference in a markdown file. */
  resolveImage?: (src: string) => Promise<string | null>;
  /** True while the bytes are still being read. */
  loading?: boolean;
  /** Plain message when the file cannot be shown. */
  error?: string;
  /** Revokes `url` and any image resolved for a markdown preview. */
  release?: () => void;
};

export type ProviderPreview =
  | {
      entry: ProviderEntry;
      url?: string;
      text?: string;
      resolveImage?: (src: string) => Promise<string | null>;
      release?: () => void;
    }
  | {
      entry: ProviderEntry;
      error: string;
      /**
       * The file was refused because it is over `PREVIEW_LIMIT_BYTES`, not because
       * reading failed. The UI shows a translated notice plus a download action; a
       * caller must never fetch or download the file on its own.
       */
      tooLarge?: boolean;
      limitBytes?: number;
      /**
       * Saves the entry on request. The preview never calls it: for a refused file the
       * download is the user's own click, and the bytes are not read before that.
       */
      download?: () => Promise<void>;
    };

const tooLarge = (
  provider: FileProvider,
  entry: ProviderEntry,
): ProviderPreview => ({
  entry,
  error: "File is too large to preview",
  tooLarge: true,
  limitBytes: PREVIEW_LIMIT_BYTES,
  download: () => downloadProviderEntry(provider, entry),
});

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
    return tooLarge(provider, entry);
  }

  let bytes: Uint8Array;
  try {
    bytes = await readAll(await provider.read(entry.path));
  } catch (error) {
    return { entry, error: plainError(error) };
  }
  // A provider that does not report a size can still hand back too much: the same
  // limit applies before the bytes become an object URL the browser has to hold.
  if (bytes.byteLength > PREVIEW_LIMIT_BYTES) {
    return tooLarge(provider, { ...entry, size: bytes.byteLength });
  }

  // A provider that lists a remote filesystem often reports no type. Falling back
  // to the name is what keeps a PDF in the viewer: a `Blob` typed
  // `application/octet-stream` makes the browser save the file instead of showing it.
  const mime = resolveMimeType(entry.name, entry.mime);
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
  const text = new TextDecoder().decode(bytes);
  if (kind === "markdown") {
    const resolver = markdownImageResolver(provider, entry);
    return {
      entry: shown,
      text,
      resolveImage: resolver.resolve,
      release: resolver.release,
    };
  }
  return { entry: shown, text };
}
