/**
 * The type a file name implies. Providers that list a remote filesystem (saia-fs,
 * saia-rag, a local folder, an MCP server) often report no `mime` at all, and a
 * preview that trusts that sends a `Blob` typed `application/octet-stream`: Chrome
 * then downloads the file instead of rendering it, so a PDF never reaches the
 * viewer. The extension is the only type signal those providers give.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  // Documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  rtf: "application/rtf",
  epub: "application/epub+zip",
  // Pictures
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff",
  // Sound and video
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  // Text and data
  txt: "text/plain",
  log: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  ts: "text/plain",
  json: "application/json",
  xml: "application/xml",
  yml: "text/yaml",
  yaml: "text/yaml",
  tex: "text/x-tex",
  // Archives
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
};

/** `undefined` when the name says nothing about the type. */
export function mimeForName(name?: string | null): string | undefined {
  if (!name) return undefined;
  const base = String(name).split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0 || dot === base.length - 1) return undefined;
  const extension = base.slice(dot + 1).toLowerCase();
  return MIME_BY_EXTENSION[extension];
}

/**
 * A reported type that tells a viewer nothing. Providers copy it from a generic
 * listing, and sending it on makes the browser save the file instead of showing it.
 */
export function isGenericMimeType(mime?: string | null): boolean {
  if (!mime) return true;
  const base = mime.split(";")[0].trim().toLowerCase();
  return (
    base === "" ||
    base === "application/octet-stream" ||
    base === "binary/octet-stream" ||
    base === "application/binary" ||
    base === "unknown/unknown"
  );
}

/**
 * The type to hand a `Blob` and the preview, preferring a real reported type over
 * the name (a provider can know a `.txt` is really JSON).
 */
export function resolveMimeType(
  name: string | null | undefined,
  reported?: string | null,
): string | undefined {
  return isGenericMimeType(reported) ? mimeForName(name) : reported ?? undefined;
}
