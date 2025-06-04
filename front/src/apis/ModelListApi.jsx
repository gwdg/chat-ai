// Fetches available AI models from the server, handles auth errors
export async function fetchAvailableModels(setShowModalSession) {
  try {
    const response = await fetch(import.meta.env.VITE_MODELS_ENDPOINT);

    if (response.status === 401) {
      setShowModalSession(true);
      return;
    }

    const { data: modelsList } = await response.json();
    return modelsList;
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return []
  }
}
