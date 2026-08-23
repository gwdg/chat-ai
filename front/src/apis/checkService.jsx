import { getDefaultSettings } from "../utils/conversationUtils";
import { createBackendClient } from "./openaiClient";

// Tests if a specific model is available and responsive
export async function checkService(model) {
  const defaultSettings = getDefaultSettings();

  try {
    // Define openai object to call backend
    const openai = createBackendClient(20000);

    // Initialize params
    const params = {
        model: defaultSettings.model.id,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant",
          },
          {
            role: "user",
            content: "Hi",
          },
        ],
        temperature: defaultSettings.temperature,
        top_p: defaultSettings.top_p,
        stream: false,
    };

    const response = await openai.chat.completions.create(params);

    return response;
  } catch (error) {
    console.error("Model availability check failed:", error);
    throw error;
  }
}
