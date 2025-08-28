import { v4 as uuidv4 } from "uuid";

export const getDefaultSettings = () => {
  let envSettings = {};

  if (import.meta.env.VITE_DEFAULT_SETTINGS) {
    try {
      envSettings = JSON.parse(import.meta.env.VITE_DEFAULT_SETTINGS);
    } catch (e) {
      envSettings = {};
    }
  }
  const result = {
    model: envSettings?.model || "",
    temperature: envSettings?.temperature || 0.5,
    top_p: envSettings?.top_p || 0.5,
    memory: envSettings?.memory || 0,
    enable_tools: envSettings?.enable_tools || false,
    enable_web_search: envSettings?.enable_web_search || false,
    arcana: envSettings?.arcana || {
      id: "",
    },
  };
  return result;
};

export const getDefaultConversation = (customSettings = {}) => {
  const defaultSettings = getDefaultSettings();
  const settings = { ...defaultSettings, ...customSettings };
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
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
};