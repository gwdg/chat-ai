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
    model: envSettings.model,
    temperature: envSettings.temperature,
    top_p: envSettings.top_p,
    memory: 2,
    enable_tools: envSettings?.enable_tools || false,
    tools: [],
    arcana: {
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
    messages: [ {
        role: "system",
        content: [
          {
            type: "text",
            data: "You are a helpful dog."
          }
        ],
      }, {
        role: "user",
        content: [
          {
            type: "text",
            data: ""
          }
        ]
      }
    ],
    settings: settings,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
};