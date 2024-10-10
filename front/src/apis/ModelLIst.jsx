//This function fetch model list
export async function getModels() {
  try {
    const response = await fetch("/models");
    const jsonResponse = await response.json();
    return jsonResponse.data;
  } catch (error) {
    console.error("Error:", error);
  }
}