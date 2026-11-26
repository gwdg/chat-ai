// A share link wires a new chat to one SAIA document collection.
//
// The reference is the collection's storage name `<owner>__<name>`, which is
// what the saia-rag tools take. It is not a grant: the service still checks the
// caller's role, so the owner has to share the collection with every recipient
// in the Arcana manager's Share tab.
//
// The link carries only the reference (`?arcana_share=<owner>__<name>`); the
// chat itself is a normal one, and the browser adds the search/read tools for
// that collection while the chat is open.

export const ARCANA_SHARE_PARAM = "arcana_share";

/** The longest reference the service could hand out, with room to spare. */
const MAX_REF_LENGTH = 320;

export type ArcanaShareRef = {
  /** The storage name `<owner>__<name>`; this is what the tools take. */
  collection: string;
  /** The collection name without the owner prefix. */
  name: string;
  owner: string;
};

/**
 * Read a collection reference out of a link, a stored setting or an import.
 *
 * The service splits `<owner>__<name>` at the first `__`, so the owner part must
 * not carry one either. Anything that cannot be a storage name (empty parts,
 * path separators, control characters, over-long text) is refused rather than
 * turned into a request.
 */
export function parseArcanaShareRef(raw: unknown): ArcanaShareRef | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > MAX_REF_LENGTH) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  if (value.includes("/") || value.includes("\\")) return null;
  const at = value.indexOf("__");
  if (at <= 0) return null;
  const owner = value.slice(0, at);
  const name = value.slice(at + 2);
  if (!owner || !name || owner.includes("__")) return null;
  return { collection: `${owner}__${name}`, name, owner };
}

/** The absolute link that opens a new chat on `collection`. */
export function buildArcanaShareLink(
  collection: unknown,
  origin: string = typeof window === "undefined" ? "" : window.location.origin,
): string {
  const ref = parseArcanaShareRef(collection);
  const base = String(origin || "").replace(/\/+$/, "");
  if (!ref || !base) return "";
  return `${base}/chat?${ARCANA_SHARE_PARAM}=${encodeURIComponent(ref.collection)}`;
}

/** The valid share binding of a conversation, or `null` when it has none. */
export function arcanaShareFromSettings(settings: any): ArcanaShareRef | null {
  const stored = settings?.arcana_share;
  if (!stored || typeof stored !== "object") return null;
  const ref = parseArcanaShareRef(stored.collection);
  if (!ref) return null;
  const name =
    typeof stored.name === "string" && stored.name.trim()
      ? stored.name.trim()
      : ref.name;
  return { ...ref, name };
}
