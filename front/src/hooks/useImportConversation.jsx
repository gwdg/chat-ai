// hooks/useImportConversation.ts (or .js)
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { getDefaultSettings } from "../utils/conversationUtils";
import { useToast } from "./useToast";
import { createConversation, ensureFolder, getFolder, importFolder, newId, saveFile } from "../db";
import { dataURLtoFile } from "../utils/attachments";
import { selectUserSettings, importUserSettings } from "../Redux/reducers/userSettingsReducer";
import { importInterfaceSettings } from "../Redux/reducers/interfaceSettingsSlice";

/**
 * useImportConversation
 * Returns an async function you can call from a component to import a conversation.
 */
export function useImportConversation() {
  const { notifySuccess, notifyError } = useToast();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const userSettings = useSelector(selectUserSettings);

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
        res = [];
        for (const item of content) {
          res.push(...extractMessageContent(item, conversationId));
        }
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
      // If contentItem is a video file
      if (content?.type === "video_url") {
        if (!content?.video_url || !content?.video_url?.url) return res;
        const dataURL = content.video_url.url; // base64 starting with data:video/..
        const filename = content?.name || content.video_url?.filename || "video";
        const file = dataURLtoFile(dataURL, filename);
        if (!file) return res; // fallback
        const fileId = saveFile(conversationId, file);
        console.log("Saved new file", fileId)
        return [{
          "type": "file",
          "fileId": fileId,
        }]
      }
      // Forms are UI-only content items and must survive a round-trip.
      if (content?.type === "form" && content.form) {
        return [{
          "type": "form",
          "form": content.form,
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

  const importConversation = async (data, silent = false, topicId = null, folderIdMap = null) => {
    const conversationId = newId();
    try {
      if (data?.user_settings) dispatch(importUserSettings(data.user_settings));
      if (data?.interface_settings) dispatch(importInterfaceSettings(data.interface_settings));

      let resolvedFolderIdMap = folderIdMap;
      if (!resolvedFolderIdMap && Array.isArray(data?.folders)) {
        resolvedFolderIdMap = new Map();
        for (const folder of data.folders) {
          const restoredId = await importFolder(folder);
          if (folder?.id && restoredId) resolvedFolderIdMap.set(folder.id, restoredId);
        }
      }

      // Handle multiple conversations import
      if (Array.isArray(data?.conversations)) {
        for (let i = 0; i < data.conversations.length; i++) {
          const isLast = i === data.conversations.length - 1;
          await importConversation(
            data.conversations[i],
            silent || !isLast,
            topicId,
            resolvedFolderIdMap,
          );
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
        if (systemMessage?.feedback !== undefined) sanitizedMessages[0].feedback = systemMessage.feedback;
        if (systemMessage?.meta !== undefined) sanitizedMessages[0].meta = systemMessage.meta;
        // Sanitize user + assistant messages
        try {       
          for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            if (!message?.role) {
              // TODO robustness - check if string and add it
              continue;
            }
            const buildImportedMessage = (role, content) => {
              const imported = { role, content };
              if (message?.feedback !== undefined) imported.feedback = message.feedback;
              if (message?.meta !== undefined) imported.meta = message.meta;
              return imported;
            };
            if (message.role === "system") continue;
            if (message.role === "info") {
              sanitizedMessages.push(
                buildImportedMessage("info", extractMessageContent(message, conversationId))
              );
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
              sanitizedMessages.push(
                buildImportedMessage("user", extractMessageContent(message, conversationId))
              );
              
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
              sanitizedMessages.push(
                buildImportedMessage("assistant", extractMessageContent(message, conversationId))
              );
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
      // Populate settings from data. Newer exports contain the complete nested
      // settings object; older exports and personas use the flat layout below.
      const baseSettings = getDefaultSettings(data?.user_settings ?? userSettings);
      let settings = { ...baseSettings };
      const structuredSettings =
        data?.settings && typeof data.settings === "object" && !Array.isArray(data.settings)
          ? data.settings
          : null;

      // Check for system prompt in data settings
      const system_prompt = extractParameter(data, "system_prompt") || extractParameter(data, "systemPrompt");
      if (system_prompt && typeof system_prompt === "string")
        sanitizedMessages[0].content = extractMessageContent(system_prompt, conversationId);

      // Legacy flat export / persona format. This also fills fields that a
      // partial `settings` object from an older file may omit.
      {
        // temperature
        const temperature =
          extractParameter(data, "temperature") ??
          extractParameter(data, "temp") ??
          extractParameter(data, "settings.temperature");
        if (typeof temperature === "number" && temperature >= 0 && temperature <= 2.0) {
          settings.temperature = temperature;
        }

        // top_p
        const top_p = extractParameter(data, "top_p") ?? extractParameter(data, "topP");
        if (typeof top_p === "number" && top_p >= 0 && top_p <= 2.0)
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
              .filter(t => t?.type)
              .map(t => [t.type, true]))
          };
          if (tools.some(t => t?.type === "web_search" || t?.type === "fetch_url")) {
            settings.enable_web_search = true;
          }
        } else if (tools && typeof tools === "object") {
          settings.tools = { ...settings.tools, ...tools };
          if (tools.web_search === true || tools.fetch_url === true) {
            settings.enable_web_search = true;
          }
        }

        const enable_web_search = extractParameter(data, "enable_web_search");
        if (typeof enable_web_search === "boolean") {
          settings.enable_web_search = enable_web_search;
        }

        // reasoning effort
        const reasoning_effort = extractParameter(data, "reasoning_effort");
        if (typeof reasoning_effort === "number") {
          settings.reasoning_effort = reasoning_effort;
        }

        // MCP servers
        const mcp_servers = extractParameter(data, "mcp_servers") || extractParameter(data, "mcp-servers");
        if (Array.isArray(mcp_servers) || typeof mcp_servers === "string") {
          settings.mcp_servers = mcp_servers;
        }

        // memory (0 is a valid value)
        const memory = extractParameter(data, "memory");
        if (memory !== null && memory !== undefined) {
          const parsedMemory = Number(memory);
          if ([0, 1, 2].includes(parsedMemory)) settings.memory = parsedMemory;
        }

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
      }

      // A complete settings object (new exports) wins over the flat fields.
      if (structuredSettings) settings = { ...settings, ...structuredSettings };

      // Merge nested defaults and normalize fields old exports may omit.
      settings.tools = {
        ...baseSettings.tools,
        ...(settings.tools && typeof settings.tools === "object" && !Array.isArray(settings.tools)
          ? settings.tools
          : {}),
      };
      if (typeof settings.model === "string") {
        settings.model = { id: settings.model, name: settings.model };
      } else if (!settings.model || typeof settings.model !== "object") {
        settings.model = { ...baseSettings.model };
      }
      const importedMemory = Number(settings.memory);
      settings.memory = [0, 1, 2].includes(importedMemory) ? importedMemory : 0;
      if (settings.arcana === undefined || settings.arcana === null) {
        settings.arcana = { id: "" };
      } else if (typeof settings.arcana === "string") {
        settings.arcana = { id: settings.arcana };
      }

      // Determine folder assignment
      let folderId = topicId;
      const folderRef =
        extractParameter(data, "folderId") ||
        extractParameter(data, "folder_id") ||
        extractParameter(data, "folder") ||
        extractParameter(data, "topicId") || 
        extractParameter(data, "topic_id") || 
        extractParameter(data, "topic");
      const folderName =
          extractParameter(data, "folderName") ||
          extractParameter(data, "folder_name") ||
          folderRef?.name;
      const folderRefId = typeof folderRef === "string" ? folderRef : folderRef?.id;
      const mappedFolderId = folderRefId
        ? resolvedFolderIdMap?.get(folderRefId) ?? null
        : null;
      if (mappedFolderId) {
        folderId = mappedFolderId;
      } else {
        if (typeof folderRef === "string") {
          const existing = await getFolder(folderRef);
          folderId = existing?.id ?? null;
        } else if (folderRef?.id) {
          const existing = await getFolder(folderRef.id);
          folderId = existing?.id ?? null;
        }
        if (!folderId && typeof folderName === "string") {
          if (typeof folderRef === "string") {
            folderId = await ensureFolder(folderName, folderRef);
          } else {
            folderId = await ensureFolder(folderName);
          }
        }
      }

      // Create new conversation
      const newId = await createConversation(
        {
          id: conversationId,
          title: data?.title || "Imported Conversation",
          messages: sanitizedMessages,
          settings: settings,
          folderId: folderId ?? "__unsorted__",
          preserveMetadata: true,
          ...(typeof data?.createdAt === "number" && { createdAt: data.createdAt }),
          ...(typeof data?.lastModified === "number" && { lastModified: data.lastModified }),
          ...(typeof data?.lastOpenedAt === "number" && { lastOpenedAt: data.lastOpenedAt }),
          ...(typeof data?.messageCount === "number" && { messageCount: data.messageCount }),
          ...(typeof data?.hasFirstPrompt === "boolean" && { hasFirstPrompt: data.hasFirstPrompt }),
          ...(typeof data?.summary === "string" && { summary: data.summary }),
          ...(typeof data?.summaryUpdatedAt === "number" && { summaryUpdatedAt: data.summaryUpdatedAt }),
          ...(typeof data?.summarySourceHash === "string" && { summarySourceHash: data.summarySourceHash }),
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
