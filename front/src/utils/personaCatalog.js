const PERSONA_REPO_OWNER = "gwdg";
const PERSONA_REPO_NAME = "chat-ai-personas";
const PERSONA_REPO_BRANCH = "main";

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const CATALOG_STORAGE_KEY = "chatai:persona-catalog:v1";

export const PERSONA_REPO = {
  owner: PERSONA_REPO_OWNER,
  name: PERSONA_REPO_NAME,
  branch: PERSONA_REPO_BRANCH,
};

export const PERSONA_MARKER_PATTERN =
  /\[\[PERSONA:([a-zA-Z0-9_./-]+\.json)\]\]/i;

let catalogCache = null;
let catalogPromise = null;
const personaCache = new Map();

function readStoredCatalog() {
  try {
    const raw = sessionStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.personas)) return null;
    if (!parsed.timestamp || Date.now() - parsed.timestamp > CATALOG_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function storeCatalog(personas) {
  try {
    sessionStorage.setItem(
      CATALOG_STORAGE_KEY,
      JSON.stringify({ timestamp: Date.now(), personas }),
    );
  } catch {
    // Session storage can be unavailable (private mode, strict CSP).
  }
}

function titleFromPath(path) {
  const filename = String(path || "").split("/").pop() || "";
  return filename.replace(/\.json$/i, "").replace(/[-_]+/g, " ");
}

export function parsePersonaText(rawText) {
  const cleaned = String(rawText || "").replace(/,(\s*[}$])/g, "$1");
  return JSON.parse(cleaned);
}

export function getPersonaDownloadUrl(path) {
  const segments = String(path || "").split("/");
  if (
    segments.length === 0 ||
    segments.some(
      (segment) => !segment || segment === "." || segment === "..",
    )
  ) {
    throw new Error("Invalid persona path");
  }

  const encodedPath = segments.map((segment) => encodeURIComponent(segment));
  return `https://raw.githubusercontent.com/${PERSONA_REPO_OWNER}/${PERSONA_REPO_NAME}/${PERSONA_REPO_BRANCH}/${encodedPath.join("/")}`;
}

function toPersonaEntry(path, data) {
  return {
    id: path,
    path,
    title: String(data?.title || "").trim() || titleFromPath(path),
    description: String(data?.subtitle || data?.description || "").trim(),
    category: path.includes("/") ? path.split("/").slice(0, -1).join("/") : "",
    url: getPersonaDownloadUrl(path),
  };
}

export async function fetchPersona(path) {
  const url = getPersonaDownloadUrl(path);
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load persona: ${response.status}`);
  }
  const data = parsePersonaText(await response.text());
  const entry = toPersonaEntry(path, data);
  personaCache.set(path, entry);
  return { entry, data };
}

export function getCachedPersona(path) {
  return personaCache.get(path) || null;
}

export async function loadPersona(path) {
  const cached = getCachedPersona(path);
  if (cached) return cached;
  const { entry } = await fetchPersona(path);
  return entry;
}

export async function loadPersonaCatalog({ force = false } = {}) {
  if (!force) {
    if (catalogCache && Date.now() - catalogCache.timestamp < CATALOG_TTL_MS) {
      return catalogCache.personas;
    }
    const stored = readStoredCatalog();
    if (stored) {
      catalogCache = stored;
      for (const persona of stored.personas) {
        personaCache.set(persona.path, persona);
      }
      return stored.personas;
    }
  }

  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    const treeResponse = await fetch(
      `https://api.github.com/repos/${PERSONA_REPO_OWNER}/${PERSONA_REPO_NAME}/git/trees/${PERSONA_REPO_BRANCH}?recursive=1`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (!treeResponse.ok) {
      throw new Error(`Failed to load persona catalog: ${treeResponse.status}`);
    }

    const tree = await treeResponse.json();
    const paths = (tree?.tree || [])
      .filter(
        (item) =>
          item?.type === "blob" &&
          /\.json$/i.test(item.path || "") &&
          !String(item.path).startsWith(".github/"),
      )
      .map((item) => item.path);

    const personas = await Promise.all(
      paths.map(async (path) => {
        try {
          return await loadPersona(path);
        } catch {
          return toPersonaEntry(path, null);
        }
      }),
    );

    personas.sort((a, b) => a.title.localeCompare(b.title));

    catalogCache = { timestamp: Date.now(), personas };
    for (const persona of personas) {
      personaCache.set(persona.path, persona);
    }
    storeCatalog(personas);
    return personas;
  })();

  try {
    return await catalogPromise;
  } finally {
    catalogPromise = null;
  }
}

export function getPersonaMarkers(text) {
  const value = String(text || "");
  const pattern = new RegExp(PERSONA_MARKER_PATTERN.source, "gi");
  const markers = [];
  let match;
  while ((match = pattern.exec(value)) !== null) {
    if (!markers.includes(match[1])) markers.push(match[1]);
  }
  return markers;
}

export function stripPersonaMarkers(text) {
  return String(text || "")
    .replace(/\[\[PERSONA:[a-zA-Z0-9_./-]+\.json\]\]/gi, "")
    .replace(/\[\[PERSONA:?[a-zA-Z0-9_./-]*\]*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}
