import { v4 as uuidv4 } from "uuid";
import { getConversation, getFolder, listConversationMetas, listFolders, loadFileMeta } from "../db";
import { processContentItems } from "./sendMessage";
import packageJson from "../../package.json";

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
    reasoning_effort: null,
    tools: {
      "web_search": false,
      "image_generation": true,
      "image_modification": true,
      "audio_generation": true,
      "video_generation": false,
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
    folderId,
    hasFirstPrompt: false,
  };
};

// Function to process message content into export format. Unlike the API
// conversion, every content item is kept so that an export can be imported
// again without losing attachments or forms.
const processMessageContent = async (content, exportFiles = false) => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content) || content.length === 0) return null;
  if (content.length === 1 && content[0]?.text != null) return content[0].text;
  if (!exportFiles) return content[0]?.text || "";

  const output = [];
  for (const item of content) {
    if (!item) continue;
    if (item.type === "form" && item.form) {
      output.push({ type: "form", form: item.form });
      continue;
    }
    const processed = await processContentItems({
      items: [item],
      convertDocs: false, // Keep OpenAI file format
    });
    const exportedItems = Array.isArray(processed)
      ? processed
      : typeof processed === "string"
        ? [{ type: "text", text: processed }]
        : [];
    if (item.type === "file" && item.fileId) {
      const meta = await loadFileMeta(item.fileId);
      if (meta?.name) {
        for (const exported of exportedItems) {
          if (exported?.type !== "text" && exported?.name === undefined) {
            exported.name = meta.name;
          }
        }
      }
    }
    output.push(...exportedItems);
  }
  return output.length > 0 ? output : null;
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
    processedMessage.content = await processMessageContent(content, exportFiles);
    if (processedMessage.content === null) continue; // Invalid message

    if (messages[i].feedback !== undefined) processedMessage.feedback = messages[i].feedback;
    if (messages[i].meta !== undefined) processedMessage.meta = messages[i].meta;

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
  
// Export all data as JSON
export const getExportData = async ({ userSettings, interfaceSettings } = {}) => {
  const conversationList = await listConversationMetas()
  const folderList = await listFolders();
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
      createdAt: conversation?.createdAt,
      lastModified: conversation?.lastModified,
      lastOpenedAt: conversation?.lastOpenedAt,
      hasFirstPrompt: conversation?.hasFirstPrompt,
      messageCount: conversation?.messageCount,
      ...(conversation?.summary !== undefined && { summary: conversation.summary }),
      ...(conversation?.summaryUpdatedAt !== undefined && { summaryUpdatedAt: conversation.summaryUpdatedAt }),
      ...(conversation?.summarySourceHash !== undefined && { summarySourceHash: conversation.summarySourceHash }),
      messages: await processMessages(conversation.messages, true),
      // Nested copy is the lossless representation; the spread keeps the
      // legacy flat layout readable by older versions of this app.
      settings: conversation.settings,
      ...conversation.settings,
    };
    processedConversations.push(processedConversation);
  }

  const processedFolders = folderList.map((folder) => ({
    id: folder.id,
    name: folder.name,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    ...(folder.icon ? { icon: folder.icon } : {}),
    ...(folder.color ? { color: folder.color } : {}),
    ...(typeof folder.sortOrder === "number" ? { sortOrder: folder.sortOrder } : {}),
  }));

  return {
    conversations: processedConversations,
    folders: processedFolders,
    ...(userSettings ? { user_settings: userSettings } : {}),
    ...(interfaceSettings ? { interface_settings: interfaceSettings } : {}),
    version: packageJson.version,
  };
}
