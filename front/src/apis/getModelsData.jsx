import config from "../config";

// Gets available models data from the server
export async function getModelsData() {
  try {
    const response = await fetch(config.modelsPath ?? "");
    // If failed, return response with error
    if (!response.ok) {
      return response;
    }
    // Extract model data from response
    const { data: modelsData } = await response.json();
    // Enrich model data with names if not present
    let enrichedModelsData = modelsData.map((model) => ({
      ...model,
      name: model.name || model.id,
    }));
    console.info(`Apply model filters: whitelist=${config.overrides?.models?.whitelist}, blacklist=${config.overrides?.models?.blacklist} on models:`, enrichedModelsData);
    if (config.overrides?.models?.whitelist) {
      enrichedModelsData = enrichedModelsData.filter(model => config.overrides.models.whitelist.includes(model.id));
    }
    if (config.overrides?.models?.blacklist) {
      enrichedModelsData = enrichedModelsData.filter(model => !config.overrides.models.blacklist.includes(model.id));
    }
    return enrichedModelsData;
  } catch (error) {
    console.error("Failed to load models data", error);
    return []
  }
}
