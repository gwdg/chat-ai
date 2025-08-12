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
    system_prompt: "You are a helpful assistant",
    memory: 2,
    enable_tools: envSettings.enable_tools,
    tools: [],
    arcana: {
      id: "",
    },
  };

  return result;
};
