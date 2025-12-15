import { v4 as uuidv4 } from "uuid";
import { useSelector } from "react-redux";
import { getConversation, listConversationMetas } from "../db";
import { processContentItems } from "./sendMessage";

export const getDefaultSettings = (userSettings = {}) => {
  // Get environment settings
  let envSettings = {};
  if (import.meta.env.VITE_DEFAULT_SETTINGS) {
    try {
      envSettings = JSON.parse(import.meta.env.VITE_DEFAULT_SETTINGS);
    } catch (e) {
      envSettings = {};
    }
  }

  // Default settings if not in envSettings or userSettings
  const defaultSettings = {
    model: {
      id: "",
      name: "",
      input: [],
      output: [],
    },
    temperature: 0.5,
    top_p: 0.5,
    memory: 0,
    enable_tools: false,
    tools: {
      "web_search": false,
      "image_generation": true,
      "image_modification": true,
      "audio_generation": true,
      "arcana": true,
      "mcp": false,
    },
    enable_web_search: false,
    arcana: {id: "",},
  };

  // Merged default settings
  const mergedSettings = Object.fromEntries(
    Object.keys(defaultSettings).map(key => [
      key,
      userSettings?.[key] ?? envSettings?.[key] ?? defaultSettings[key]
    ])
  );
  return mergedSettings ;
};

export const getDefaultConversation = (userSettings = {}) => {
  const settings = getDefaultSettings(userSettings);
  const now = Date.now();
  return {
    id: uuidv4(),
    title: "Untitled Conversation",
    messageCount: 2,
    messages: [ {
        role: "system",
        content: [
          {
            type: "text",
            text: "You are a helpful assistant."
          }
        ],
      }, {
        role: "user",
        content: [
          {
            type: "text",
            text: ""
          }
        ]
      }
    ],
    settings: settings,
    createdAt: now,
    lastModified: now,
  };
};

// Function to process messages into export format
const processMessages = async (messages, exportFiles = false) => {
  let processedMessages = [];
  if (!Array.isArray(messages)) return processedMessages;
  let expectUser = true;
  for (let i = 0; i < messages.length; i++) {
    if (!messages[i]?.content) continue;
    const role = messages[i]?.role;
    if (!["system", "user", "assistant", "info"].includes(role)) continue;
    const content = messages[i].content;
    let processedMessage = {"role": role};
    if (typeof content === "string") processedMessage.content = content;
    else if (Array.isArray(content)) {
      if (content.length === 0) continue; // Invalid message
      if (content.length === 1 && content[0]?.text != null) {
        processedMessage.content = content[0].text;
      } else if (exportFiles) {
        // Content includes files
        processedMessage.content = await processContentItems({
          items: content,
          convertDocs: false, // Keep OpenAI file format
        })
      } else {
        // Ignore files
        processedMessage.content = content[0]?.text || "";
      }
    }

    // Check if empty user prompt at the end
    if (i === messages.length-1 
      && processedMessage.role === "user" 
      && processedMessage.content === "")
        continue;

    // Handle user-assistant not switching roles
    if (role === "assistant" && expectUser)
      processedMessages.push({"role": "user", "content": ""})
    else if (role === "user" && !expectUser)
      processedMessages.push({"role": "assistant", "content": ""})

    processedMessages.push(processedMessage);
    if (role === "user") expectUser = false;
    if (role === "assistant") expectUser = true;
  }
  return processedMessages;
}
  
// Function to process settings into export format
const processSettings = (conversation, exportArcana = false) => {
  let settings = {}
  if (conversation?.title) settings.title = conversation.title;
  if (conversation?.settings?.temperature) settings.temperature = conversation.settings.temperature;
  if (conversation?.settings?.top_p) settings.top_p = conversation.settings.top_p;
  if (exportArcana && isArcanaSupported && conversation?.settings?.arcana?.id) {
    settings.arcana = conversation.settings.arcana;
  }
  if (conversation?.settings?.model) {
    if (typeof conversation.settings.model === "string") settings.model = conversation.settings.model;
    else if (conversation.settings.model?.id) {
      settings.model = conversation.settings.model.id
      if (conversation.settings.model?.name) settings["model-name"] = conversation.settings.model.name;
    }
  }
  return settings
};

// Export all data as JSON
export const getExportData = async () => {
  const conversationList = await listConversationMetas()
  const processedConversations = [];
  // Process Messages
  for (let c = 0; c < conversationList.length; c++) {
    const conversationId = conversationList[c].id
    if (!conversationId) continue;
    const conversation = await getConversation(conversationId);
    if (!conversation) continue;
    console.log("Converting conversation ", conversationId);

    // Initialize conversation for export
    const processedConversation = {
      id: conversationId,
      title: conversation?.title || "Untitled Conversation",
      messages: await processMessages(conversation.messages, true),
      ...conversation.settings,
    };
    processedConversations.push(processedConversation);
  }
  return { conversations: processedConversations, version: "0.9.0" };
  // TODO package version
};
