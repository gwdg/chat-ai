//This function fetch model list
export async function getModels(setShowModalSession) {
  try {
    const response = await fetch("/models");
    if (response.status === 401) {
      setShowModalSession(true);
      return;
    }
    const jsonResponse = await response.json();
    return jsonResponse.data;
  } catch (error) {
    console.error("Error:", error);
  }
}
