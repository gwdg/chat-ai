//This function fetch model list
export async function getModels() {
  try {
    const response = await fetch("/chat-ai/models/");
    return response.json();
  } catch (error) {
    console.error("Error:", error);
  }
}
