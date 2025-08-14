// Gets available models data from the server
export async function getModelsData() {
  try {
    const response = await fetch(import.meta.env.VITE_MODELS_ENDPOINT);
    // If failed, return response with error
    if (!response.ok) {
      return response;
    }
    // Extract model data from response
    const { data: modelsData } = await response.json();
    return modelsData;
  } catch (error) {
    console.error("Failed to load models data", error);
    return []
  }
}
