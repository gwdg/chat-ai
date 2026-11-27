// The pages an Arcana answer quotes: the source card under the reply.
//
// A search hit only carries the passage, and the user's next question is
// usually "where does that come from?". The read tools therefore also return the
// hit page and the page after it, the app appends them to the assistant message
// as an invisible marker (the pattern the Meta chat and the Arcana approval card
// already use), and the card below the answer opens the document at that page.
//
// The marker is built here, by the app, and never by the model: it costs no
// tokens and a model cannot spell one differently. The payload is base64 JSON
// because an excerpt contains `]]` and newlines, which would end a plain marker
// early. This module stays pure so the chat shell can parse markers without
// loading the saia-rag client.
const MARKER = "ARCANA_DOCUMENT";
const MARKER_SOURCE = `\\[\\[${MARKER}:\\s*([A-Za-z0-9+/=_-]+)\\s*\\]\\]`;

/** One embedded excerpt is capped: the marker travels in the message text. */
export const MAX_ARCANA_EXCERPT_CHARS = 6_000;

/** The hit page plus the one after it. */
export const MAX_ARCANA_DOCUMENT_PAGES = 2;

const MAX_REF_LENGTH = 320;
const MAX_NAME_LENGTH = 255;

/** `[Page 12]: #`, the marker the docling converter writes per page. */
const PAGE_MARKER = /^\[Page (\d+)\]:\s*#\s*$/;
/** docling's own layout hints; they mean nothing to a reader. */
const LAYOUT_MARKER = /^\[(?:Y \d+|Split)\]:\s*#\s*$/;

export type ArcanaDocument = {
  /** The collection reference, `owner/name` — the same id the tools take. */
  collection: string;
  filename: string;
  /** The first embedded page, absent for a plain text file. */
  page?: number;
  /** How many pages the excerpt holds (1 or 2). */
  pages: number;
  /** The passage, with its `[Page N]: #` headings kept for per-page rendering. */
  excerpt: string;
};

const markerPattern = () => new RegExp(MARKER_SOURCE, "g");

const toBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const fromBase64 = (value: string): string => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
};

const cleanName = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > MAX_NAME_LENGTH) return null;
  if (name === "." || name === "..") return null;
  if (/[\\/\u0000-\u001f]/.test(name)) return null;
  return name;
};

const cleanPage = (value: unknown): number | undefined => {
  const page = Math.floor(Number(value));
  return Number.isFinite(page) && page >= 1 ? page : undefined;
};

/**
 * One validated document, or `null`.
 *
 * The same function builds a document in the tool runner and reads one back
 * from a marker, so a crafted or truncated marker can never reach the card with
 * a field the runner would not have produced.
 */
export function normalizeArcanaDocument(value: unknown): ArcanaDocument | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const collection =
    typeof source.collection === "string" ? source.collection.trim() : "";
  if (
    !collection ||
    collection.length > MAX_REF_LENGTH ||
    /[\u0000-\u001f]/.test(collection)
  ) {
    return null;
  }
  const filename = cleanName(source.filename);
  if (!filename) return null;
  const excerpt =
    typeof source.excerpt === "string" ? source.excerpt.trim() : "";
  if (!excerpt) return null;
  const page = cleanPage(source.page);
  const pages = Math.min(
    Math.max(cleanPage(source.pages) ?? 1, 1),
    MAX_ARCANA_DOCUMENT_PAGES,
  );
  return {
    collection,
    filename,
    ...(page ? { page } : {}),
    pages,
    excerpt: excerpt.slice(0, MAX_ARCANA_EXCERPT_CHARS),
  };
}

/** One identity per cited page range, so a repeated tool call is listed once. */
export function arcanaDocumentKey(document: ArcanaDocument | null): string {
  if (!document) return "";
  return `${document.collection}\u0000${document.filename}\u0000${document.page ?? 0}`;
}

/** The marker for one validated document. */
export function serializeArcanaDocument(document: ArcanaDocument): string {
  const normalized = normalizeArcanaDocument(document);
  if (!normalized) {
    throw new Error("Cannot serialize an invalid Arcana document.");
  }
  return `[[${MARKER}:${toBase64(JSON.stringify(normalized))}]]`;
}

/**
 * Add source markers to an answer.
 *
 * The markers come from the app, so any marker-shaped text the model wrote
 * itself is dropped first.
 */
export function appendArcanaDocumentMarkers(
  text: string,
  documents: ArcanaDocument[] = [],
): string {
  const body = String(text ?? "")
    .replace(markerPattern(), "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
  const markers = documents
    .filter(Boolean)
    .map((document) => serializeArcanaDocument(document))
    .join("");
  if (!markers) return body;
  return body ? `${body}\n\n${markers}` : markers;
}

/**
 * Every cited document in an assistant message, deduplicated.
 *
 * `collection` limits the result to the Arcana page that is open; `collections`
 * limits it to the list a normal chat is bound to. A marker that names another
 * collection is ignored, so a replayed or imported message can never make this
 * chat open a document it was not given.
 */
export function getArcanaDocuments(
  text: unknown,
  collection?: string | null,
  collections?: string[] | null,
): ArcanaDocument[] {
  const source = String(text ?? "");
  if (!source.includes(MARKER)) return [];
  const expected =
    typeof collection === "string" ? collection.trim() : "";
  const allowed =
    Array.isArray(collections) && collections.length
      ? new Set(collections.map((value) => String(value).trim()))
      : null;
  const documents = new Map<string, ArcanaDocument>();
  const pattern = markerPattern();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    let payload: unknown;
    try {
      payload = JSON.parse(fromBase64(match[1]));
    } catch {
      continue;
    }
    const document = normalizeArcanaDocument(payload);
    if (!document) continue;
    if (expected && document.collection !== expected) continue;
    if (allowed && !allowed.has(document.collection)) continue;
    const key = arcanaDocumentKey(document);
    if (!documents.has(key)) documents.set(key, document);
  }

  return [...documents.values()];
}

/** The transcript, without the markers. */
export function stripArcanaDocumentMarkers(text: unknown): unknown {
  if (typeof text !== "string") return text;
  return text
    .replace(markerPattern(), "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

/** A page's text, ready for the card. */
export type ArcanaDocumentPage = { page: number | null; text: string };

/**
 * Split an excerpt into its pages.
 *
 * A converted document's text carries `[Page N]: #` before each page and the
 * converter's `[Y n]` / `[Split]` hints inside it. The card labels each page and
 * drops the hints, so the reader sees the document, not the converter's marks.
 */
export function splitDocumentPages(text: unknown): ArcanaDocumentPage[] {
  const pages: ArcanaDocumentPage[] = [];
  let current: { page: number | null; lines: string[] } = {
    page: null,
    lines: [],
  };
  const flush = () => {
    const body = current.lines.join("\n").trim();
    if (body) pages.push({ page: current.page, text: body });
    current = { page: null, lines: [] };
  };

  for (const line of String(text ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (LAYOUT_MARKER.test(trimmed)) continue;
    const page = trimmed.match(PAGE_MARKER);
    if (page) {
      flush();
      current.page = Number(page[1]);
      continue;
    }
    current.lines.push(line);
  }
  flush();
  return pages;
}

/** The page span a card shows, for its label. */
export function documentPageRange(
  document: ArcanaDocument,
): { from: number; to: number } | null {
  if (!document.page) return null;
  return {
    from: document.page,
    to: document.page + Math.max(document.pages, 1) - 1,
  };
}
