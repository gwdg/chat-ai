// A share link wires a new chat to one SAIA document collection.
//
// The link keeps the shape the Arcana manager has always handed out
// (`/chat?arcana=<owner>/<name>&enable_tools=true`): that is the "Arcana ID"
// people read in the manager and the link the user docs show. The collection's
// storage name `<owner>__<name>` (what the saia-rag tools take) is derived from
// it here, and both spellings are accepted on the way in.
//
// The reference is not a grant: the service still checks the caller's role, so
// the owner has to share the collection with every recipient in the Arcana
// manager's Share tab.

export const ARCANA_SHARE_PARAM = "arcana_share";
/** The access-link parameter, `<owner>/<name>` (`?arcana=alice/papers`). */
export const ARCANA_LINK_PARAM = "arcana";

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
 * Two spellings name the same collection: the Arcana ID `alice/papers` (what
 * the manager shows and the access link carries) and the storage name
 * `alice__papers` (what the tools take). `/` can appear in neither part, and
 * the service splits the storage name at its first `__`, so an owner that
 * carries one itself could never be addressed back. Anything that cannot be a
 * storage name (empty parts, a second separator, control characters,
 * over-long text) is refused rather than turned into a request.
 */
export function parseArcanaShareRef(raw: unknown): ArcanaShareRef | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > MAX_REF_LENGTH) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  if (value.includes("\\")) return null;
  let owner: string;
  let name: string;
  if (value.includes("/")) {
    const at = value.indexOf("/");
    owner = value.slice(0, at);
    name = value.slice(at + 1);
    if (name.includes("/")) return null;
  } else {
    const at = value.indexOf("__");
    if (at < 0) return null;
    owner = value.slice(0, at);
    name = value.slice(at + 2);
  }
  if (!owner || !name || owner.includes("__")) return null;
  return { collection: `${owner}__${name}`, name, owner };
}

/** The Arcana ID people read and type: `<owner>/<name>`. */
export function arcanaRefId(ref: ArcanaShareRef): string {
  return `${ref.owner}/${ref.name}`;
}

/** The absolute link that opens a new chat on `collection`. */
export function buildArcanaShareLink(
  collection: unknown,
  origin: string = typeof window === "undefined" ? "" : window.location.origin,
): string {
  const ref = parseArcanaShareRef(collection);
  const base = String(origin || "").replace(/\/+$/, "");
  if (!ref || !base) return "";
  // No `model` parameter: the recipient keeps their own default model, and the
  // chat is a normal one apart from the collection it is bound to.
  const id = `${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.name)}`;
  return `${base}/chat?${ARCANA_LINK_PARAM}=${id}&enable_tools=true`;
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
