import { getDefaultSettings } from "../utils/settingsUtils";

export default async function generateTitle(conversation, settings) {
  const defaultSettings = getDefaultSettings();

  let processedConversation = conversation.map((message) => {
    // Handle case where content is an array (containing text and image objects)
    if (message.role === "user" && Array.isArray(message.content)) {
      return {
        role: "user",
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

  const titlePrompt =
    "Create a very short title (maximum 4 words) for this conversation that captures its main topic. Respond only with the title - no quotes, punctuation, or additional text.";

  try {
    // TODO Replace with openai or chatCompletions
    const baseURL = import.meta.env.VITE_BACKEND_ENDPOINT + "/chat/completions"
    const response = await fetch(baseURL, {
      method: "post",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({
        model: defaultSettings.model,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          ...processedConversation.slice(1),
          { role: "user", content: titlePrompt },
        ],
        temperature: settings.temperature,
        top_p: settings.top_p,
      }),
    });

    if (!response.ok) throw new Error(response.statusText);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let title = "";
    let streamComplete = false;

    // Stream response until complete
    while (!streamComplete) {
      const { value, done } = await reader.read();
      if (done) {
        streamComplete = true;
        break;
      }
      title += decoder.decode(value, { stream: true });
    }

    return title?.trim();
  } catch (error) {
    // Handle AbortError specifically
    if (error.name === "AbortError") {
      return "Untitled Conversation";
    }
    console.error("Title generation failed:", error);
    return "Untitled Conversation";
  }
}