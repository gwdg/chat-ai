import { getDefaultSettings } from "../utils/settingsUtils";

// Tests if a specific model is available and responsive
async function checkModelAvailability(modelName) {
  const defaultSettings = getDefaultSettings();

  try {
    const response = await fetch("/chat-ai-backend", {
      method: "post",
      headers: {
        "Content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
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

export { checkModelAvailability };
