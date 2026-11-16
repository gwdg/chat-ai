// Finding the published public keys of the E2EE model nodes.
//
// A deployment publishes one file per model node under one key directory:
//
//   <base>/<MODELNAME>.pub
//
// The name comes from the model **id**, not its display name: a name may carry
// spaces and punctuation, and an id may carry a "/" (bridge models). Every run
// of characters outside `[A-Za-z0-9._-]` becomes a single "-", so
// `bridge/deepseek-v4.1-flash-1017` is published as
// `bridge-deepseek-v4.1-flash-1017.pub`. `encryption/generate-model-keys.mjs`
// writes the same names, so the generator and the import cannot disagree.
//
// This module deliberately has no imports: the generator (a plain Node script
// outside the front end) imports it, and the front end's `@noble` dependencies
// are not installed for that script.

/** Where GWDG publishes the model node keys unless the config says otherwise. */
export const DEFAULT_KEY_BASE_URL =
  "https://docs.ai.gwdg.de/technical/saia-platform/keys/";

/**
 * The `.pub` file name for a model id.
 *
 * Ids are already URL-safe in practice; the mapping only exists so an id with a
 * "/" or another exotic character stays a single flat file name.
 */
export function publishedKeyFileName(modelId) {
  const raw = String(modelId ?? "").trim();
  const safe = raw
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/[.-]+$/, "");
  return `${safe || "model"}.pub`;
}

/**
 * The absolute URL of a model's published key.
 *
 * `baseUrl` may be relative (it then resolves against the page origin) and may
 * omit the trailing slash; a missing slash is added so the file does not
 * replace the last path segment.
 */
export function publishedKeyUrl(baseUrl, modelId) {
  const base = String(baseUrl ?? "").trim();
  if (!base) throw new Error("The key base URL is empty.");
  const directory = base.endsWith("/") ? base : `${base}/`;
  const origin = globalThis.location?.origin ?? "http://localhost";
  return new URL(
    publishedKeyFileName(modelId),
    new URL(directory, origin),
  ).toString();
}

/**
 * Downloads `<base>/<file>.pub` for every model.
 *
 * A 404 is not a failure: most models have no E2EE node and therefore no
 * published key, so it is reported separately as `missing`. An answer that is
 * not an ok status, a body that cannot be read or a network error is a
 * `failed` entry, because a directory that answers something unexpected is a
 * configuration problem worth showing.
 *
 * @returns {Promise<{
 *   found: Array<{model: object, url: string, text: string}>,
 *   missing: object[],
 *   failed: Array<{model: object, url: string, reason: string}>,
 * }>} in model order.
 */
export async function fetchPublishedKeyTexts({
  baseUrl,
  models,
  fetchImpl = (...args) => globalThis.fetch(...args),
  onProgress,
  concurrency = 4,
}) {
  const list = (Array.isArray(models) ? models : []).filter(
    (model) => model && model.id,
  );
  const results = new Array(list.length);
  let cursor = 0;
  let done = 0;

  const work = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= list.length) return;
      const model = list[index];
      let url = "";
      try {
        url = publishedKeyUrl(baseUrl, model.id);
        // Deliberately no Authorization header: the directory is a public,
        // CORS-enabled host, and the app's bearer token must never leave for it.
        // `no-cache` revalidates so a rotated key is not served from the HTTP
        // cache after the node was re-provisioned.
        const response = await fetchImpl(url, {
          headers: { Accept: "text/plain, application/octet-stream" },
          cache: "no-cache",
        });
        if (response.status === 404) {
          results[index] = { kind: "missing", model, url };
        } else if (!response.ok) {
          results[index] = {
            kind: "failed",
            model,
            url,
            reason: `HTTP ${response.status}`,
          };
        } else {
          results[index] = { kind: "found", model, url, text: await response.text() };
        }
      } catch (error) {
        results[index] = {
          kind: "failed",
          model,
          url,
          reason: error?.message || "network error",
        };
      }
      done += 1;
      onProgress?.({ done, total: list.length });
    }
  };

  const workers = Math.max(1, Math.min(concurrency, list.length || 1));
  await Promise.all(Array.from({ length: workers }, work));

  const found = [];
  const missing = [];
  const failed = [];
  for (const entry of results) {
    if (!entry) continue;
    if (entry.kind === "found") {
      found.push({ model: entry.model, url: entry.url, text: entry.text });
    } else if (entry.kind === "missing") {
      missing.push(entry.model);
    } else {
      failed.push({ model: entry.model, url: entry.url, reason: entry.reason });
    }
  }
  return { found, missing, failed };
}
