// hooks/useImportConversation.ts (or .js)
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { getDefaultSettings } from "../utils/conversationUtils";
import { useToast } from "./useToast";
import { createConversation } from "../db";

/**
 * useImportConversation
 * Returns an async function you can call from a component to import a conversation.
 */
export function useImportConversation() {
  const { notifySuccess, notifyError } = useToast();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const defaultSettings = getDefaultSettings();

  const extractMessageContent = (message) => {
    const res = [{
      "type": "text",
      "text": "",
    }]
    try {
      if (!message) return res;
      const content = message?.content || message;
      if (!content) return res;
      // if message or content is string
      if (typeof content === "string") {
        res[0].text = content;
        return res;
      }    
      // if message or content is array
      if (Array.isArray(content)) {
        res = content.map(item => extractMessageContent(item));
        if (res[0]?.type !== "text") {
          res.unshift({type: "text", text: ""});
        } 
        return res;
      }
      // if message or content has "text" element
      if (typeof content?.text === "string") {
        res[0].text = content.text;
        return res;
      }
      // if message or content has "data" element
      if (typeof content?.data === "string") {
        res[0].text = content.data;
        return res;
      }
    } catch(err) {
      console.warn("Failed to parse message:", err)
    }
    return res;
  }

  const importConversation = async (data) => {
    try {
      const defaultSettings = getDefaultSettings();
      
      // Sanitize messages
      let sanitizedMessages = [ {
        role: "system",
        content: [
          {
            type: "text",
            text: "You are a helpful assistant."
          }
        ],},
      ];
  
      let expectUserMessage = true; // switch roles after each message
      if (data?.messages) {
        // Look for system prompt
        const systemMessage = data.messages.find((msg) => msg.role === "system");
        sanitizedMessages[0].content = extractMessageContent(systemMessage);
        // Sanitize user + assistant messages
        try {       
          for (let i = 0; i < data.messages.length; i++) {
            const message = data.messages[i];
            if (!message?.role) {
              // TODO robustness - check if string and add it
              continue;
            }
            if (message.role === "system") continue;
            if (message.role === "info") {
              sanitizedMessages.push(extractMessageContent(message));
              continue;
            }

            if (message.role === "user") {
              if (!expectUserMessage) {
                // Add an empty assistant message to fix the ordering
                sanitizedMessages.push({
                  "role": "assistant",
                  "content": [{
                    "type": "text",
                    "text": "",
                  }]
                })
                expectUserMessage = true;
              }
              sanitizedMessages.push({
                "role": "user",
                "content": extractMessageContent(message),
              })
              
            } else if (message.role === "assistant") {
              if (expectUserMessage) {
                // Add an empty user message to fix the ordering
                sanitizedMessages.push({
                  "role": "user",
                  "content": [{
                    "type": "text",
                    "text": "",
                  }]
                })
                expectUserMessage = false;
              }
              sanitizedMessages.push({
                "role": "assistant",
                "content": extractMessageContent(message),
              })
            } else {
              console.warn("Unrecognized role: ", message.role)
              continue;
            }
            expectUserMessage = !expectUserMessage;
          }
        } catch (err) {
          console.warn("Failed to extract all messages:", err)
        }
      }

      // Final touches
      if (!expectUserMessage) {
        sanitizedMessages.push({
          "role": "assistant",
          "content": [{
            "type": "text",
            "text": "",
          }],
        })
        expectUserMessage = true;
      }

      // Push user message as prompt
      sanitizedMessages.push({
        "role": "assistant",
        "content": [{
          "type": "text",
          "text": "",
        }]
      })

      // Create new conversation
      const newId = await createConversation(
        {
          title: data?.title || "Imported Conversation",
          messages: sanitizedMessages,
          settings: defaultSettings,
        },
      )

      if (!newId) {
        throw new Error("Failed to create new conversation");
      }

      navigate(`/chat/${newId}`, { replace: true });
      notifySuccess("Chat imported successfully");
    } catch (error) {
      console.error("Import error:", error);
      notifyError("Failed to import conversation")
      throw new Error("Failed to import conversation");
    }
  }

  return importConversation;
}
