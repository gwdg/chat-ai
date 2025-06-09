// Imports
import {
  addConversation,
  updateConversation,
} from "../Redux/reducers/conversationsSlice";

export const importConversation = async (
  data,
  dispatch,
  currentConversationId,
  defaultModel,
  notifyError,
  notifySuccess,
  navigate
) => {
  try {
    // Create new conversation
    const action = dispatch(addConversation());
    const newId = action.payload?.id;

    if (!newId) {
      throw new Error("Failed to create new conversation");
    }

    // Handle both formats: array and object with messages
    const messages = Array.isArray(data) ? data : data.messages;

    if (!Array.isArray(messages)) {
      throw new Error("Invalid format: messages must be an array");
    }

    // Process messages into conversation format
    const newArray = [];
    for (let i = 0; i < messages.length; i++) {
      const currentMessage = messages[i];

      if (currentMessage.role === "info") {
        newArray.push({
          info: currentMessage.content,
        });
        continue;
      }
      if (
        currentMessage.role === "user" &&
        messages[i + 1]?.role === "assistant"
      ) {
        let userContent = currentMessage.content;
        let images = [];

        // Handle different content types (text and images)
        if (Array.isArray(userContent)) {
          let textContent = "";

          userContent.forEach((item) => {
            if (item.type === "text") {
              textContent += item.text + "\n";
            } else if (item.type === "image_url" && item.image_url) {
              images.push({
                type: item.type,
                image_url: {
                  url: item.image_url.url,
                },
              });
            }
          });

          const responseObj = {
            prompt: textContent?.trim(),
            images: images,
            response: messages[i + 1]?.content,
          };

          newArray.push(responseObj);
        } else {
          const responseObj = {
            prompt: userContent,
            response: messages[i + 1]?.content,
          };

          newArray.push(responseObj);
        }
      }
    }

    // Find system message
    const systemMessage = messages.find((msg) => msg.role === "system");

    // Get title
    const title = data.title || "Imported Conversation";

    // Prepare settings with optional fields
    const settings = {
      systemPrompt: systemMessage?.content || "You are a helpful assistant",
      ["model-name"]: defaultModel.name,
      model: defaultModel.id,
      temperature: 0.5, // default value
      top_p: 0.5, // default value
      memory: 0,
    };

    // If it's object format, apply any provided settings
    if (!Array.isArray(data)) {
      if (data["model-name"]) settings["model-name"] = data["model-name"];
      if (data.model) settings.model = data.model;
      if (data.temperature !== undefined)
        settings.temperature = Number(data.temperature);
      if (data.top_p !== undefined) settings.top_p = Number(data.top_p);
    }

    // Prepare conversation update
    const updates = {
      conversation: messages,
      responses: newArray,
      title,
      settings,
    };

    // Only add arcana if both id and key are present
    if (!Array.isArray(data) && data.arcana?.id) {
      updates.arcana = {
        id: data.arcana.id,
        // key: parsedData.arcana.key,
      };
    }

    // Update conversation
    dispatch(
      updateConversation({
        id: newId,
        updates,
      })
    );

    // Navigate and notify
    navigate(`/chat/${newId}`, { replace: true });
    notifySuccess("Chat imported successfully");
  } catch (error) {
    console.error("Import error:", error);
    notifyError(error.message || "An unexpected error occurred");
    navigate(`/chat/${currentConversationId}`, { replace: true });
    window.location.reload();
  }
};
