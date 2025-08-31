import { v4 as uuidv4 } from "uuid";
import { useSelector } from "react-redux";

export const getDefaultSettings = (userSettings = {}) => {
  let envSettings = {};

  if (import.meta.env.VITE_DEFAULT_SETTINGS) {
    try {
      envSettings = JSON.parse(import.meta.env.VITE_DEFAULT_SETTINGS);
    } catch (e) {
      envSettings = {};
    }
  }
  // Codebase default settings if not in envSettings or userSettings
  const defaultSettings = {
    model: "",
    temperature: 0.5,
    top_p: 0.5,
    memory: 0,
    enable_tools: false,
    enable_web_search: false,
    arcana: {id: "",},
  };
  return { ...defaultSettings, ...envSettings, ...userSettings } ;
};

export const getDefaultConversation = (userSettings = {}) => {
  const settings = getDefaultSettings(userSettings);
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