import { v4 as uuidv4 } from "uuid";
import { getConversation, getFolder, listConversationMetas } from "../db";
import { currentBrand, localizeBrandValue } from "../config/brands";
import {
  brandFixedModel,
  isBrandExternalAllowed,
} from "../config/brandPolicy";
import { processContentItems } from "./sendMessage";
import packageJson from "../../package.json";
import i18n from "../i18n";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

/** The active brand's localized system prompt, or the Chat AI default. */
export const getDefaultSystemPrompt = () => {
  const prompt = localizeBrandValue(currentBrand()?.systemPrompt, i18n.language);
  return (
    (typeof prompt === "string" ? prompt.trim() : "") || DEFAULT_SYSTEM_PROMPT
  );
};

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
    memory_mode_override: "default",
    memory_group_override: "default",
    enable_tools: false,
    reasoning_effort: null,
    tools: {
      "web_search": false,
      "image_generation": true,
      "image_modification": true,
      "audio_generation": true,
      "arcana_tools": false,
      "arcana": true,
      "mcp": false,
      // Agent mode only. Access storage is on by default: the model may read and write the files
      // of this chat (see agent/storageAccess.ts). An attached workspace has its own write switch.
      "workspace_write_access": true,
      "browser_storage": true,
      "create_docx": true,
    },
    audio: {
      voice: "auto",
      language: "auto",
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
  const tools = mergedSettings.tools;
  // `arcana_v2` and `remote_file_access` are the previous names of the toggle.
  if (tools && typeof tools === "object" && tools.arcana_tools === undefined) {
    const legacy =
      tools.arcana_v2 !== undefined ? tools.arcana_v2 : tools.remote_file_access;
    if (legacy !== undefined) {
      mergedSettings.tools = { ...tools, arcana_tools: legacy };
      delete mergedSettings.tools.arcana_v2;
      delete mergedSettings.tools.remote_file_access;
    }
  }
  applyBrandRestrictionsToDefaults(mergedSettings);
  return mergedSettings ;
};

/**
 * A brand may fix the model and switch off options that talk to third parties.
 * This is the default for new conversations; existing ones are narrowed again at
 * send time (utils/sendMessage.jsx, agent/tools.ts, agent/mcp.ts).
 */
const applyBrandRestrictionsToDefaults = (settings) => {
  const fixedModel = brandFixedModel();
  // Unknown capabilities are safer than the previous model's: the model selector
  // replaces this stub with the real entry from `/models` once it loads, and a
  // stale name would show the wrong model until then.
  if (fixedModel && settings.model?.id !== fixedModel) {
    settings.model = { id: fixedModel, name: fixedModel, input: [], output: [] };
  }
  if (!isBrandExternalAllowed("web_search")) {
    settings.enable_web_search = false;
  }
  if (settings.tools && typeof settings.tools === "object") {
    settings.tools = { ...settings.tools };
    if (!isBrandExternalAllowed("web_search")) {
      settings.tools.web_search = false;
      settings.tools.fetch_url = false;
    }
    if (!isBrandExternalAllowed("mcp")) {
      settings.tools.mcp = false;
    }
  }
};

export const getDefaultChatAIModel = (userSettings = {}) => {
  const settings = getDefaultSettings(userSettings);
  return (
    settings?.model?.id ||
    import.meta.env.VITE_TITLE_GENERATION_MODEL ||
    ""
  );
};

export const getSecretDefaultChatAIModel = () => {
  const settings = getDefaultSettings();
  return (
    settings?.model?.id ||
    import.meta.env.VITE_TITLE_GENERATION_MODEL ||
    ""
  );
};

export const getDefaultConversation = (userSettings = {}, folderId = null) => {
  const settings = getDefaultSettings(userSettings);
  const now = Date.now();
  return {
    id: uuidv4(),
    title: "Untitled Chat",
    messageCount: 2,
    messages: [ {
        role: "system",
        content: [
          {
            type: "text",
            text: getDefaultSystemPrompt()
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
    folderId,
    hasFirstPrompt: false,
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
  const conversationList = (await listConversationMetas()).filter(
    (conversation) =>
      !conversation.isMetaChat && conversation.id !== "meta-chat",
  );
  const processedConversations = [];
  // Process Messages
  for (let c = 0; c < conversationList.length; c++) {
    const conversationId = conversationList[c].id
    if (!conversationId) continue;
    const conversation = await getConversation(conversationId);
    if (!conversation) continue;
    console.log("Converting conversation ", conversationId);

    // Initialize conversation for export
    const folderRow = conversation?.folderId ? await getFolder(conversation.folderId) : null;
    const processedConversation = {
      id: conversationId,
      title: conversation?.title || "Untitled Chat",
      folderId: conversation?.folderId ?? null,
      folderName: folderRow?.name ?? null,
      messages: await processMessages(conversation.messages, true),
      ...(conversation.persona ? { persona: conversation.persona } : {}),
      ...conversation.settings,
    };
    processedConversations.push(processedConversation);
  }

  const metaConversation = await getConversation("meta-chat");
  const metaChat = metaConversation
    ? {
        ...metaConversation.settings,
        title: metaConversation.title || "Meta chat",
        settings: metaConversation.settings,
        messages: await processMessages(metaConversation.messages, true),
        isMetaChat: true,
      }
    : null;

  return {
    conversations: processedConversations,
    ...(metaChat ? { meta_chat: metaChat } : {}),
    version: packageJson.version,
  };
};
