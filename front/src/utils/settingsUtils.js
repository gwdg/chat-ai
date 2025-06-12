// utils/settingsUtils.js

/**
 * Get default settings from environment variables with fallbacks
 * @returns {Object} Default settings object
 */
export const getDefaultSettings = () => {
  const envSettings = import.meta.env.VITE_DEFAULT_SETTINGS || {};

  return {
    ["model-name"]: envSettings.modelName,
    model: envSettings.model,
    temperature: envSettings.temperature,
    top_p: envSettings.top_p,
    systemPrompt: "You are a helpful assistant",
    memory: 0,
  };
};
