// A share link wires a new chat to one SAIA document collection.
//
// The link opens the chat's Arcana Tools list (`/chat?arcana-tools=<owner>/<name>`),
// the read-only tools this app runs itself, not the deprecated single Arcana id
// the server-side gateway used. `<owner>/<name>` is the "Arcana ID" people read
// in the manager and the form the saia-rag tools take; the older
// `<owner>__<name>` storage spelling is still read on the way in.
//
// The reference is not a grant: the service still checks the caller's role, so
// the owner has to share the collection with every recipient in the Arcana
// manager's Share tab.

export const ARCANA_SHARE_PARAM = "arcana_share";
/** The access-link parameter, `<owner>/<name>` (`?arcana-tools=alice/papers`). */
export const ARCANA_LINK_PARAM = "arcana-tools";
/**
 * The parameter the link used before it wrote Arcana Tools, still read so an
 * older link keeps working. It named the same collection.
 */
export const ARCANA_LEGACY_LINK_PARAM = "arcana";

/** The longest reference the service could hand out, with room to spare. */
const MAX_REF_LENGTH = 320;

export type ArcanaShareRef = {
  /** The reference form `<owner>/<name>`; this is what the tools take. */
  collection: string;
  /** The collection name without the owner prefix. */
  name: string;
  owner: string;
  /**
   * A short note the user writes for the agent, telling it what the collection
   * is good for. `list_arcanas` returns it so the model can pick a collection.
   */
  description?: string;
};

/** How long a binding description may get before it is clipped. */
const MAX_DESCRIPTION_LENGTH = 280;

const cleanText = (value: unknown, max: number): string => {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/** Read one stored binding object (`{collection, name?, description?}`). */
function refFromStored(value: unknown): ArcanaShareRef | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as Record<string, unknown>;
  const ref = parseArcanaShareRef(stored.collection);
  if (!ref) return null;
  const name = cleanText(stored.name, 120) || ref.name;
  const description = cleanText(stored.description, MAX_DESCRIPTION_LENGTH);
  return description ? { ...ref, name, description } : { ...ref, name };
}

/**
 * Read a collection reference out of a link, a stored setting or an import.
 *
 * `alice/papers` is the form this app stores and both the link and the
 * saia-rag tools use. The older storage spelling `alice__papers` is still
 * accepted, because chats and settings written before the form changed carry
 * it, and it is normalised to the slash form here. `/` can appear in neither
 * part, and the service splits the legacy spelling at its first `__`, so an
 * owner that carries one itself could never be addressed back. Anything that
 * cannot be a reference (empty parts, a second slash, control characters,
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
  return { collection: `${owner}/${name}`, name, owner };
}

/** The Arcana ID people read and type: `<owner>/<name>`. */
export function arcanaRefId(ref: ArcanaShareRef): string {
  return `${ref.owner}/${ref.name}`;
}

/**
 * The absolute link that opens a new chat on `collection`.
 *
 * The chat reads the collection through its Arcana Tools list, which is what
 * `?arcana-tools=` appends on load.
 */
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

/**
 * Every collection this chat can read, deduplicated by storage name.
 *
 * `settings.arcana_shares` is the list the chat owns, the user edits, and an
 * access link appends to; `settings.arcana_share` is the single binding an
 * older link writes and is still accepted, so a chat linked before the list
 * existed keeps working. A description on either representation survives the
 * merge.
 */
export function arcanaSharesFromSettings(settings: any): ArcanaShareRef[] {
  const shares: ArcanaShareRef[] = [];
  const byCollection = new Map<string, ArcanaShareRef>();
  const add = (ref: ArcanaShareRef | null) => {
    if (!ref) return;
    const existing = byCollection.get(ref.collection);
    if (existing) {
      if (!existing.description && ref.description) {
        existing.description = ref.description;
      }
      return;
    }
    byCollection.set(ref.collection, ref);
    shares.push(ref);
  };
  const stored = settings?.arcana_shares;
  if (Array.isArray(stored)) {
    for (const value of stored) add(refFromStored(value));
  }
  add(refFromStored(settings?.arcana_share));
  return shares;
}

/** The first collection binding of a conversation, or `null` when it has none. */
export function arcanaShareFromSettings(settings: any): ArcanaShareRef | null {
  return arcanaSharesFromSettings(settings)[0] ?? null;
}
