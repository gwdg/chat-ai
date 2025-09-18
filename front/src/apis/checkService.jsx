import { getDefaultSettings } from "../utils/conversationUtils";
import OpenAI from "openai";

// Tests if a specific model is available and responsive
export async function checkService(model) {
  const defaultSettings = getDefaultSettings();

  try {
    let baseURL = import.meta.env.VITE_BACKEND_ENDPOINT;
    try {
      // If absolute, parse directly
      baseURL = new URL(baseURL).toString();
    } catch {
      // If relative, resolve against current origin
      baseURL = new URL(baseURL, window.location.origin).toString();
    }

    // Define openai object to call backend
    const openai = new OpenAI({
      baseURL : baseURL,
      apiKey: null,
      dangerouslyAllowBrowser: true,
      timeout: 20000
    });

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
