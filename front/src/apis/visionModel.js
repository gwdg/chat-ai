// Whether this deployment can describe an image at all: the vision model the agent's
// `explain_image` tool uses has to be part of the deployment's model list. The list is
// fetched once and shared, because a preview header asks on every image it shows.
import { EXPLAIN_IMAGE_MODEL } from "./agentEndpoints";
import { getModelsData } from "./getModelsData";

const CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {{ at: number; ids: Set<string> } | null} */
let cache = null;

/** Test seam: forget the cached model list. */
export function resetVisionModelCache() {
  cache = null;
}

export async function isVisionModelAvailable() {
  const modelId = EXPLAIN_IMAGE_MODEL();
  if (!modelId) return false;

  if (!cache || Date.now() - cache.at > CACHE_TTL_MS) {
    let models;
    try {
      models = await getModelsData();
    } catch {
      models = null;
    }
    // A failed or refused lookup says nothing about the deployment, so it is not
    // cached: the next image asks again instead of staying greyed out.
    if (!Array.isArray(models)) return false;
    cache = {
      at: Date.now(),
      ids: new Set(
        models.map((model) => model?.id).filter((id) => typeof id === "string"),
      ),
    };
  }

  return cache.ids.has(modelId);
}
