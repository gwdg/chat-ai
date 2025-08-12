// hooks/useImportConversation.ts (or .js)
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { addConversation, updateConversation } from "../Redux/reducers/conversationsSlice";
import { getDefaultSettings } from "../utils/settingsUtils";
import { useToast } from "./useToast";

/**
 * useImportConversation
 * Returns an async function you can call from a component to import a conversation.
 */
export function useImportConversation() {
  const { notifySuccess, notifyError } = useToast();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const importConversation = async (data) => {
    try {
      const defaultSettings = getDefaultSettings();
      const defaultModel = { name: "Hi", id: "TODO" };

      // Create new conversation
      const action = dispatch(addConversation());
      const newId = action?.payload?.id;

      if (!newId) {
        throw new Error("Failed to create new conversation");
      }

      // Handle both formats: array and object with messages
      const messages = Array.isArray(data) ? data : data?.messages;

      if (!Array.isArray(messages)) {
        throw new Error("Invalid format: messages must be an array");
      }

      // Process messages into conversation format
      const responses = [];
      for (let i = 0; i < messages.length; i++) {
        const currentMessage = messages[i];

        if (currentMessage.role === "info") {
          responses.push({ info: currentMessage.content });
          continue;
        }

        if (currentMessage.role === "user" && messages[i + 1]?.role === "assistant") {
          const userContent = currentMessage.content;
          let images = [];

          if (Array.isArray(userContent)) {
            let textContent = "";

            userContent.forEach((item) => {
              if (item.type === "text") {
                textContent += (item.text ?? "") + "\n";
              } else if (item.type === "image_url" && item.image_url) {
                images.push({
                  type: item.type,
                  image_url: { url: item.image_url.url },
                });
              }
            });

            responses.push({
              prompt: textContent.trim(),
              images,
              response: messages[i + 1]?.content,
            });
          } else {
            responses.push({
              prompt: userContent,
              response: messages[i + 1]?.content,
            });
          }

          // IMPORTANT FIX: Skip the assistant message in the next iteration
          // since we've already processed it as part of this user-assistant pair
          i++;
        } else if (currentMessage.role === "user") {
          // Handle user message without assistant response (incomplete conversation)
          responses.push({
            prompt: currentMessage.content,
            response: "",
          });
        }
        // Skip standalone assistant messages or system messages in the loop
        // (system message is handled separately below)
      }

      // System message (optional)
      const systemMessage = messages.find((msg) => msg.role === "system");

      // Title
      const title = data.title || "Imported Conversation";

      // Settings with defaults
      const settings = {
        systemPrompt: systemMessage?.content || "You are a helpful assistant",
        ["model-name"]: defaultModel.name,
        model: defaultModel.id,
        temperature: defaultSettings.temperature,
        top_p: defaultSettings.top_p,
        memory: 2,
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
        messages,
        responses,
        title,
        settings,
      };

      if (!Array.isArray(data) && data.arcana?.id) {
        updates.arcana = { id: data.arcana.id };
      }

      // Update the conversation
      dispatch(updateConversation({ id: newId, updates }));

      // Go to the new chat & notify
      navigate(`/chat/${newId}`, { replace: true });
      //notifySuccess("Chat imported successfully");
      // let caller handle notification this is only a hook
    } catch (error) {
      console.error("Import error:", error);
      throw new Error("Failed to import conversation");
      //notifyError(error?.message || "An unexpected error occurred");
      // Keep this if you explicitly want a hard refresh on failure
      //window.location.reload();
    }
  }

  return importConversation;
}
