// Fetches available AI models from the server, handles auth errors
export async function getModelsData() {
  try {
    const response = await fetch(import.meta.env.VITE_MODELS_ENDPOINT);
    
    if (response.status === 401) {
      return 401;
    }

    const { data: modelsData } = await response.json();
    return modelsData;
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return []
  }
}
