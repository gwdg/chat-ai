// Importing published E2EE node keys: paste, a `.pub` file, one URL per key, or
// a key directory that lists several keys and model bindings at once.
//
// The formats are deliberately forgiving, because a directory is published as
// plain JSON next to the documentation:
//
//   { "keys": [ { "id", "name", "publicKey" | "key" | "url", "models": [...] } ],
//     "models": { "<model id>": "<key id>" } }
//
// A key entry may carry a `url` instead of the key itself; that URL is fetched
// and its text is parsed as the base64url public key.
import { E2eeKeyError, keyId, parsePublicKey } from "./protocol";
import { normalizeE2eeKeys } from "./registry";

const text = (value) =>
  typeof value === "string" ? value.trim() : "";

/** A stable, readable id for a key that carries none. Derived from its fingerprint. */
export function keyEntryId(publicKeyBytes) {
  return `key-${keyId(publicKeyBytes)}`;
}

/**
 * Turns key text (base64url, possibly a whole `.pub` file with comments) into a
 * stored key entry. Throws `E2eeKeyError` when it does not parse.
 */
export function keyEntryFromText(raw, { name = "", url = "", source = "paste", id } = {}) {
  const cleaned = String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    // Ignore comment lines, then drop the `ssh-ed25519` prefix and any trailing
    // comment so only the base64url token is left.
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.replace(/^[A-Za-z0-9-]+\s+/, "").split(/\s+/)[0] ?? "")
    .filter(Boolean)
    .join("");
  const bytes = parsePublicKey(cleaned);
  const kid = keyId(bytes);
  return {
    id: id || keyEntryId(bytes),
    name: text(name),
    publicKey: cleaned,
    source,
    ...(text(url) ? { url: text(url) } : {}),
    addedAt: new Date().toISOString(),
    kid,
  };
}

/** Parses a key directory document. */
export function parseKeyDirectory(value) {
  const document = typeof value === "string" ? JSON.parse(value) : value;
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new E2eeKeyError("The key directory is not a JSON object.");
  }
  const rawKeys = Array.isArray(document.keys)
    ? document.keys
    : Array.isArray(document.publicKeys)
      ? document.publicKeys
      : [];
  const keys = rawKeys
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => {
      const publicKey = text(entry.publicKey ?? entry.key ?? entry.pubkey);
      const url = text(entry.url ?? entry.publicKeyUrl ?? entry.keyUrl);
      return {
        // Only an explicit id is kept; otherwise the fingerprint names the key.
        id: text(entry.id) || "",
        name: text(entry.name ?? entry.title ?? entry.model) || text(entry.id),
        publicKey,
        url,
        models: Array.isArray(entry.models)
          ? entry.models.map(text).filter(Boolean)
          : [],
        index,
      };
    });
  const models =
    document.models && typeof document.models === "object" && !Array.isArray(document.models)
      ? Object.fromEntries(
          Object.entries(document.models)
            .map(([modelId, value]) => [text(modelId), text(value)])
            .filter(([modelId, value]) => modelId && value),
        )
      : {};
  if (!keys.length && !Object.keys(models).length) {
    throw new E2eeKeyError("The key directory contains no keys.");
  }
  return { keys, models };
}

async function fetchText(url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, { headers: { Accept: "text/plain, application/json" } });
  } catch {
    throw new E2eeKeyError(`Could not reach ${url}.`);
  }
  if (!response.ok) {
    throw new E2eeKeyError(`${url} answered with ${response.status}.`);
  }
  return response.text();
}

/** Downloads one key by URL and parses it as a public key. */
export async function fetchKeyFromUrl(url, { name = "", fetchImpl = (...args) => globalThis.fetch(...args) } = {}) {
  const body = await fetchText(text(url), fetchImpl);
  return keyEntryFromText(body, { name, url, source: "url" });
}

/**
 * Downloads and resolves a key directory: every entry either carries its key or
 * a URL to it.
 *
 * @returns {{keys: object[], models: Record<string,string>}}
 */
export async function fetchKeyDirectory(url, { fetchImpl = (...args) => globalThis.fetch(...args) } = {}) {
  const body = await fetchText(text(url), fetchImpl);
  const directory = parseKeyDirectory(body);
  const resolved = [];
  for (const entry of directory.keys) {
    if (entry.publicKey) {
      resolved.push({
        entry,
        key: keyEntryFromText(entry.publicKey, {
          ...(entry.id ? { id: entry.id } : {}),
          name: entry.name,
          source: "directory",
        }),
      });
      continue;
    }
    if (!entry.url) {
      throw new E2eeKeyError(
        `The key directory entry "${entry.name || entry.id}" carries neither a key nor a URL.`,
      );
    }
    const target = entry.url.startsWith("http")
      ? entry.url
      : new URL(
          entry.url,
          new URL(text(url), globalThis.location?.origin ?? "http://localhost"),
        ).toString();
    resolved.push({
      entry,
      key: await fetchKeyFromUrl(target, { name: entry.name, fetchImpl }),
    });
  }
  const byValue = new Map();
  for (const { entry, key } of resolved) {
    for (const value of [entry.id, entry.name, key.id, key.name]) {
      if (value) byValue.set(value, key.id);
    }
  }
  const models = {};
  for (const { entry, key } of resolved) {
    for (const modelId of entry.models) models[modelId] = key.id;
  }
  for (const [modelId, value] of Object.entries(directory.models)) {
    models[modelId] = byValue.get(value) || value;
  }
  return { keys: resolved.map(({ key }) => key), models };
}

/**
 * Reads every `.pub` file in a local directory chosen with
 * `showDirectoryPicker()`.
 *
 * The folder is validated file by file with the same canonical key check as the
 * other import paths: a file that is not a 43-character base64url X25519 public
 * key is reported in `errors` and skipped, so one stray file cannot abort the
 * import. `files` carries the parsed key and the file name, which the caller
 * maps back to a model id.
 *
 * @returns {Promise<{
 *   files: Array<{ fileName: string, key: object }>,
 *   errors: Array<{ fileName: string, reason: string }>,
 * }>}
 */
export async function readKeyFolder(handle) {
  const files = [];
  const errors = [];
  for await (const item of handle.values()) {
    if (item?.kind !== "file") continue;
    const fileName = text(item.name);
    if (!fileName.toLowerCase().endsWith(".pub")) continue;
    try {
      const key = keyEntryFromText(await item.text(), {
        name: fileName.slice(0, -".pub".length),
        source: "folder",
      });
      files.push({ fileName, key });
    } catch (error) {
      errors.push({
        fileName,
        reason: error?.message || "Not a public key.",
      });
    }
  }
  files.sort((a, b) => a.fileName.localeCompare(b.fileName));
  return { files, errors };
}

/** The text a `.pub` download contains. */
export function publicKeyFileText(entry) {
  const name = text(entry?.name);
  const key = text(entry?.publicKey);
  return `${name ? `# ${name}\n` : ""}${key}\n`;
}

/** Applies a fetched directory to the store-facing shape, keeping known keys. */
export function mergeKeyImport(existingKeys, incomingKeys) {
  const keys = normalizeE2eeKeys(existingKeys).slice();
  for (const key of incomingKeys) {
    const index = keys.findIndex((item) => item.id === key.id);
    if (index >= 0) keys[index] = { ...keys[index], ...key, id: key.id };
    else keys.push(key);
  }
  return keys;
}
