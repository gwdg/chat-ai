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
    ["model-name"]: envSettings.modelName,
    model: envSettings.model,
    temperature: envSettings.temperature,
    top_p: envSettings.top_p,
    systemPrompt: "You are a helpful assistant",
    memory: 0,
  };

  return result;
};
