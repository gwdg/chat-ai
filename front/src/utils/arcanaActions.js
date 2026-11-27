// The Arcana chat's proposed changes: the model proposes, the user accepts.
//
// The model never writes in the Arcana chat. A write tool returns a proposal
// instead of an operation, the app appends it to the assistant message as an
// invisible marker (the same pattern the Meta chat uses), and the card below the
// message parses that marker. Its Accept click is the only path to
// `arcanaActionApply`, which is a separate module because it pulls in the
// saia-rag provider and the MCP SDK on purpose: this file stays pure so the chat
// shell can parse markers without loading either.
//
// The payload is base64-encoded JSON, not plain JSON: a proposed file's previous
// text may contain `]]`, which would end a plain marker early.
import { formatBytes } from "./formatBytes";

const MARKER = "ARCANA_ACTION";
const MARKER_SOURCE = `\\[\\[${MARKER}:\\s*([A-Za-z0-9+/=_-]+)\\s*\\]\\]`;

/** One reverted text is capped: the marker travels in the message text. */
export const MAX_ARCANA_RESTORE_BYTES = 200_000;

const MAX_NAME_LENGTH = 255;
const MAX_TAG_LENGTH = 64;
const MAX_TAGS = 50;

const OPS = new Set([
  "upload_attachment",
  "write_text_file",
  "delete_file",
  "start_index",
  "set_file_tags",
]);

const markerPattern = () => new RegExp(MARKER_SOURCE, "g");

const toBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const fromBase64 = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
};

const cleanName = (value) => {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > MAX_NAME_LENGTH) return null;
  if (name === "." || name === "..") return null;
  if (/[\\/\u0000-\u001f]/.test(name)) return null;
  return name;
};

const cleanText = (value) => (typeof value === "string" ? value : null);

const cleanSize = (value) => {
  const size = Number(value);
  return Number.isFinite(size) && size >= 0 ? size : undefined;
};

const cleanTags = (value) => {
  if (!Array.isArray(value)) return null;
  const tags = [];
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const tag = entry.trim();
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) return null;
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags.slice(0, MAX_TAGS);
};

/**
 * One validated action, or `null`.
 *
 * The same function builds a proposal in the tool runner and reads one back
 * from a marker, so a crafted or truncated marker can never reach the apply
 * path with a field the runner would not have produced.
 */
export function normalizeArcanaAction(value) {
  if (!value || typeof value !== "object") return null;
  const op = String(value.op ?? "").trim();
  const collection =
    typeof value.collection === "string" ? value.collection.trim() : "";
  if (!OPS.has(op) || !collection) return null;

  const base = { op, collection };

  switch (op) {
    case "start_index":
      return base;

    case "upload_attachment": {
      const filename = cleanName(value.filename);
      const fileId =
        typeof value.fileId === "string" ? value.fileId.trim() : "";
      if (!filename || !fileId) return null;
      return {
        ...base,
        filename,
        fileId,
        size: cleanSize(value.size),
        existed: value.existed === true,
      };
    }

    case "write_text_file": {
      const filename = cleanName(value.filename);
      if (!filename || typeof value.content !== "string") return null;
      return {
        ...base,
        filename,
        content: value.content,
        size: cleanSize(value.size),
        existed: value.existed === true,
        previousText: cleanText(value.previousText),
      };
    }

    case "delete_file": {
      const filename = cleanName(value.filename);
      if (!filename) return null;
      return {
        ...base,
        filename,
        size: cleanSize(value.size),
        restoreText: cleanText(value.restoreText),
      };
    }

    case "set_file_tags": {
      const filename = cleanName(value.filename);
      const tags = cleanTags(value.tags);
      const previousTags = cleanTags(value.previousTags);
      if (!filename || !tags || !previousTags) return null;
      return { ...base, filename, tags, previousTags };
    }

    default:
      return null;
  }
}

/** One identity per proposed change, so a repeated tool call is not listed twice. */
export function arcanaActionKey(action) {
  if (!action) return "";
  if (action.op === "start_index") return `${action.op}:${action.collection}`;
  if (action.op === "set_file_tags") {
    return `${action.op}:${action.filename}:${(action.tags ?? []).join(",")}`;
  }
  return `${action.op}:${action.filename}`;
}

/**
 * Can this change be undone from what the proposal captured?
 *
 * Deliberately derived, never read from the payload: a marker cannot claim that
 * a destructive change is reversible.
 */
export function arcanaActionReversible(action) {
  if (!action) return false;
  switch (action.op) {
    case "set_file_tags":
      return Array.isArray(action.previousTags);
    case "write_text_file":
      return action.existed !== true || typeof action.previousText === "string";
    case "delete_file":
      return typeof action.restoreText === "string";
    case "upload_attachment":
      return action.existed !== true;
    default:
      return false;
  }
}

/** A row's text: an i18n key plus the values it needs. */
export function arcanaActionSummary(action) {
  if (!action) return null;
  switch (action.op) {
    case "upload_attachment":
      return {
        key: "arcana_chat.action_upload",
        values: {
          name: action.filename,
          size: formatBytes(action.size ?? 0),
          collection: action.collection,
        },
      };
    case "write_text_file":
      return {
        key: "arcana_chat.action_write",
        values: {
          name: action.filename,
          size: formatBytes(action.size ?? 0),
        },
      };
    case "delete_file":
      return {
        key: "arcana_chat.action_delete",
        values: { name: action.filename },
      };
    case "start_index":
      return {
        key: "arcana_chat.action_index",
        values: { collection: action.collection },
      };
    case "set_file_tags":
      return {
        key: "arcana_chat.action_tags",
        values: {
          name: action.filename,
          tags: action.tags.length ? action.tags.join(", ") : "—",
        },
      };
    default:
      return null;
  }
}

/** The marker for one validated action. */
export function serializeArcanaAction(action) {
  const normalized = normalizeArcanaAction(action);
  if (!normalized) {
    throw new Error("Cannot serialize an invalid Arcana action.");
  }
  return `[[${MARKER}:${toBase64(JSON.stringify(normalized))}]]`;
}

/**
 * Add proposal markers to an answer.
 *
 * The markers come from the app, not from the model, so they cost no tokens and
 * a model cannot spell one differently.
 */
export function appendArcanaActionMarkers(text, actions = []) {
  const body = String(text ?? "")
    .replace(markerPattern(), "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
  const markers = actions
    .filter(Boolean)
    .map((action) => serializeArcanaAction(action))
    .join("");
  if (!markers) return body;
  return body ? `${body}\n\n${markers}` : markers;
}

/**
 * Every proposal in an assistant message, deduplicated.
 *
 * `collection` is the Arcana the chat is showing. A marker that names another
 * collection is ignored, so a replayed or imported message can never make this
 * page write to somebody else's Arcana.
 */
export function getArcanaActionProposals(text, collection) {
  const source = String(text ?? "");
  if (!source.includes(MARKER)) return [];
  const expected =
    typeof collection === "string" ? collection.trim() : "";
  const proposals = new Map();
  const pattern = markerPattern();
  let match;

  while ((match = pattern.exec(source)) !== null) {
    let payload;
    try {
      payload = JSON.parse(fromBase64(match[1]));
    } catch {
      continue;
    }
    const action = normalizeArcanaAction(payload);
    if (!action) continue;
    if (expected && action.collection !== expected) continue;
    const key = arcanaActionKey(action);
    if (!proposals.has(key)) proposals.set(key, action);
  }

  return [...proposals.values()];
}

/** The transcript, without the markers. */
export function stripArcanaActionMarkers(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(markerPattern(), "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}
