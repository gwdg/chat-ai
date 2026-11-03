function normalizeModel(model) {
  if (!model || typeof model !== "object") return null;
  const id = typeof model.id === "string" ? model.id.trim() : "";
  if (!id) return null;
  return {
    ...model,
    id,
    name:
      typeof model.name === "string" && model.name.trim()
        ? model.name
        : id,
    // Extended selectors inspect these arrays. A custom /models route may
    // provide metadata such as `description` without the OpenAI input/output
    // fields, so normalise them instead of crashing during render.
    input: Array.isArray(model.input) ? model.input : [],
    output: Array.isArray(model.output) ? model.output : [],
  };
}

// Gets available models data from the server
export async function getModelsData() {
  try {
    const response = await fetch(import.meta.env.VITE_MODELS_ENDPOINT);
    // If failed, return response with error
    if (!response.ok) {
      return response;
    }
    const payload = await response.json();
    const modelsData = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : null;
    if (!modelsData) {
      return new Response(
        JSON.stringify({ error: "The models endpoint did not return a model list." }),
        {
          status: 502,
          statusText: "Invalid model list",
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return modelsData.map(normalizeModel).filter(Boolean);
  } catch (error) {
    console.error("Failed to load models data", error);
    return [];
  }
}
