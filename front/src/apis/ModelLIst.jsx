//This function fetch model list
export async function getModels(setShowModelSession) {
  try {
    const response = await fetch("/models");
    if (response.status === 401) {
      setShowModelSession(true);
      return;
    }
    const jsonResponse = await response.json();
    return jsonResponse.data;
  } catch (error) {
    console.error("Error:", error);
  }
}
