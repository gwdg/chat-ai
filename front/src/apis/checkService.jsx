import { getDefaultSettings } from "../utils/conversationUtils";

// Tests if a specific model is available and responsive
async function checkService(model) {
  const defaultSettings = getDefaultSettings();

  try {
    // TODO Replace with openai or chatCompletions
    const baseURL = import.meta.env.VITE_BACKEND_ENDPOINT + "/chat/completions"
    const response = await fetch(baseURL, {
      method: "post",
      headers: {
        "Content-type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant",
          },
          {
            role: "user",
            content: "hi",
          },
        ],
        temperature: defaultSettings.temperature,
        top_p: defaultSettings.top_p,
      }),
    });

    return response;
  } catch (error) {
    console.error("Model availability check failed:", error);
    throw error;
  }
}

export { checkService };
