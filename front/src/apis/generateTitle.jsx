import { getDefaultSettings } from "../utils/conversationUtils";
import { createBackendClient } from "./openaiClient";

export default async function generateTitle(messages) {
  const defaultSettings = getDefaultSettings();

  let processedMessages = messages.map((message) => {
    // Handle case where content is an array (containing text and image objects)
    if ((message.role === "user" || message.role === "assistant") && Array.isArray(message.content)) {
      return {
        role: message.role,
        content: message.content
          .filter((item) => item.type === "text")
          .map((item) => item.text)
          .join("\n"),
      };
    }
    // Handle case where content is a string but contains image data
    else if (
      message.content &&
      typeof message.content === "string" &&
      message.content.includes("data:image")
    ) {
      // Remove the image data URL portion
      return {
        role: message.role,
        content: message.content.replace(
          /data:image\/[^;]+;base64,[^"]+/g,
          "[Image]"
        ),
      };
    }
    // Return unchanged for other cases
    return message;
  });

  // Only keep standard messages
  processedMessages = processedMessages.filter(
    (message) => (message.role === "user" || message.role === "assistant")
  );

  // Remove last message if it is from the user
  processedMessages = processedMessages.filter((message, index) => {
    if (message.role === "user" && index === processedMessages.length - 1) {
      return false;
    }
    return true;
  });

  const titlePrompt =
    "Create a very short title (maximum 4 words) for this conversation that captures its main topic. Respond only with the title - no quotes, punctuation, or additional text.";

  try {
    // Define openai object to call backend
    const openai = createBackendClient(20000);

    // Initialize params
    const params = {
       model: import.meta.env.VITE_TITLE_GENERATION_MODEL || defaultSettings.model.id,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          ...processedMessages,
          { role: "user", content: titlePrompt },
        ],
        temperature: defaultSettings.temperature,
        top_p: defaultSettings.top_p,
        stream: false,
    };

    const response = await openai.chat.completions.create(params);
    const title = response?.choices[0]?.message?.content || "Untitled Chat"
    return title?.trim();
  } catch (error) {
    // Handle AbortError specifically
    if (error.name === "AbortError") {
      return "Untitled Chat";
    }
    console.error("Title generation failed:", error);
    return "Untitled Chat";
  }
}