// hooks/useImportConversation.ts (or .js)
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { getDefaultSettings } from "../utils/conversationUtils";
import { useToast } from "./useToast";
import { createConversation, newId, saveFile } from "../db";
import { dataURLtoFile } from "../utils/attachments";
import { selectUserSettings } from "../Redux/reducers/userSettingsReducer";

/**
 * useImportConversation
 * Returns an async function you can call from a component to import a conversation.
 */
export function useImportConversation() {
  const { notifySuccess, notifyError } = useToast();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const userSettings = useSelector(selectUserSettings);
  const defaultSettings = getDefaultSettings(userSettings);

  const extractMessageContent = (message, conversationId = null) => {
    let res = [{
      "type": "text",
      "text": "",
    }]
    try {
      if (!message) return res; // Fallback
      const content = message?.content || message;
      if (!content) return res;
      // if message or content is string
      if (typeof content === "string") {
        res[0].text = content;
        return res;
      }

      // if message or content is array
      if (Array.isArray(content)) {
        res = content.map(item => extractMessageContent(item, conversationId)[0]);
        if (res[0]?.type !== "text") {
          res.unshift({type: "text", text: ""});
        } 
        return res;
      }
      // If contentItem is an image
      if (content?.type === "image_url") {
        if (!content?.image_url || !content?.image_url?.url) return res;
        const dataURL = content.image_url.url; // base64 starting with data:image/..
        const filename = content?.name || content.image_url?.filename || "image";
        const file = dataURLtoFile(dataURL, filename);
        if (!file) return res; // fallback
        const fileId = saveFile(conversationId, file);
        console.log("Saved new file", fileId)
        return [{
          "type": "file",
          "fileId": fileId,
        }]
      }
      // If contentItem is an audio file
      if (content?.type === "input_audio") {
        if (!content?.input_audio || !content?.input_audio?.data) return res;
        const format = content.input_audio?.format || "wav";
        const filename = content?.name || content.input_audio?.filename || "audio"; 
        const mimeType = format === "wav" ? "audio/wav" : "audio/mpeg";
        // Convert OpenAI format to DataURL
        const dataURL = "data:" + mimeType + ";base64," + content.input_audio.data;
        const file = dataURLtoFile(dataURL, filename);
        if (!file) return res; // fallback
        const fileId = saveFile(conversationId, file);
        console.log("Saved new file", fileId)
        return [{
          "type": "file",
          "fileId": fileId,
        }]
      }
      // If contentItem is any file
      if (content?.type === "file") {
        if (!content?.file || !content?.file?.file_data) return res;
        const data = content.file.file_data; // base64
        const filename = content?.name || content.file?.filename || "file"; 
        const file = dataURLtoFile(data, filename);
        if (!file) return res; // fallback
        const fileId = saveFile(conversationId, file);
        console.log("Saved new file", fileId)
        return [{
          "type": "file",
          "fileId": fileId,
        }]
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

  function extractParameter(data, key) {
    return (
      data?.[key] ??
      data?.settings?.[key] ??
      data?.model?.[key] ??
      data?.arcana?.[key] ??
      null
    );
  }

  const importConversation = async (data, silent = false) => {
    const conversationId = newId();
    try {
      // Handle multiple conversations import
      if (Array.isArray(data?.conversations)) {
        for (const c of data.conversations) {
          importConversation(c);
        }
        return;
      }
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
      const messages = data?.messages || data?.conversation || (Array.isArray(data) ? data : undefined);
      if (messages) {
        // Look for system prompt
        const systemMessage = messages.find((msg) => msg.role === "system");
        sanitizedMessages[0].content = extractMessageContent(systemMessage, conversationId);
        // Sanitize user + assistant messages
        try {       
          for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            if (!message?.role) {
              // TODO robustness - check if string and add it
              continue;
            }
            if (message.role === "system") continue;
            if (message.role === "info") {
              sanitizedMessages.push({
                "role": "info",
                "content": extractMessageContent(message, conversationId),
              });
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
                "content": extractMessageContent(message, conversationId),
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
                "content": extractMessageContent(message, conversationId),
              })

              if (message?.feedback){
                sanitizedMessages[sanitizedMessages.length-1].feedback = message.feedback;
              }
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

      // Make sure there is an user message at the end, as the prompt
      // if (!expectUserMessage) {
      //   sanitizedMessages.push({
      //     "role": "assistant",
      //     "content": [{
      //       "type": "text",
      //       "text": "",
      //     }],
      //   })
      //   expectUserMessage = true;
      // }
      // Push user message as prompt
      if (expectUserMessage) {
        sanitizedMessages.push({
          "role": "user",
          "content": [{
            "type": "text",
            "text": "",
          }]
        })
      }
      // Populate settings from data
      let settings = defaultSettings;

      // Check for system prompt in data settings
      const system_prompt = extractParameter(data, "system_prompt") || extractParameter(data, "systemPrompt");
      if (system_prompt && typeof system_prompt === "string")
        sanitizedMessages[0].content = extractMessageContent(system_prompt, conversationId);
      
      // temperature
      const temperature =
        extractParameter(data, "temperature") ??
        extractParameter(data, "temp") ??
        extractParameter(data, "settings.temperature");
      if (typeof temperature === "number" && temperature >= 0 && temperature <= 2.0) {
        settings.temperature = temperature;
      }

      // top_p
      const top_p = extractParameter(data, "top_p") || extractParameter(data, "topP");
      if (top_p && typeof top_p === "number" && top_p > 0 && top_p <= 2.0)
        settings.top_p = top_p;

      // model
      let model = {};
      const model_id = extractParameter(data, "model") || extractParameter(data, "model_api") || extractParameter(data, "model-id");
      if (model_id) {
        if (typeof model_id === "string") {
          model.id = model_id;
          model.name = model_id;
        }
        else if (typeof model_id?.id === "string") {
          model = model_id;
        }
      }
      const model_name = extractParameter(data, "model-name") || extractParameter(data, "model_name");
      if (model_name && typeof model_name === "string") {
        model.name = model_name;
      }
      // Replace model if we have all information
      if (model?.id && model?.name) settings.model = model;

      // tools
      const enable_tools = extractParameter(data, "enable_tools")
      if (typeof enable_tools === "boolean") {
        settings.enable_tools = enable_tools;
      }
      const tools = extractParameter(data, "tools");
      if (Array.isArray(tools)) {
        const allFalse = Object.fromEntries(
          Object.keys(settings.tools || {}).map(key => [key, false])
        );
        settings.tools = {
          ...allFalse,
          ...Object.fromEntries(tools
            .filter(t => t.type !== "web_search" && t.type !== "fetch_url")
            .map(t => [t.type, true]))
        };
        // TODO check if web search can be added
      } else if (tools && typeof tools === "object") {
        tools['web_search'] = false;
        tools['fecth_url'] = false;
        settings.tools = tools
      }

      // MCP servers
      const mcp_servers = extractParameter(data, "mcp_servers") || extractParameter(data, "mcp-servers");
      if (Array.isArray(mcp_servers) || typeof mcp_servers === "string") {
        settings.mcp_servers = mcp_servers;
      }

      // memory
      const memory = extractParameter(data, "memory");
      if (memory && typeof memory === "number" && [0, 1, 2].some(v => v == memory))
        settings.memory = [0,1,2].find(v => v == memory);

      // arcana
      let arcana = {};
      const arcana_id = extractParameter(data, "arcana");
      if (arcana_id) {
        if (typeof arcana_id === "string") {
          arcana.id = arcana_id;
        } else if (typeof arcana_id?.id === "string") {
          arcana = arcana_id;
        }
      }
      // Replace arcana if exists
      if (arcana?.id) settings.arcana = arcana;

      // Create new conversation
      const newId = await createConversation(
        {
          id: conversationId,
          title: data?.title || "Imported Conversation",
          messages: sanitizedMessages,
          settings: settings,
        },
      )

      if (!newId) {
        throw new Error("Failed to create new conversation");
      }
      console.log("Navigating to new chat");
      if (!silent) navigate(`/chat/${newId}`, { replace: true });
      if (!silent) notifySuccess("Chat imported successfully");
    } catch (error) {
      console.error("Import error:", error);
      notifyError("Failed to import conversation")
      throw new Error("Failed to import conversation");
    }
  }

  return importConversation;
}
