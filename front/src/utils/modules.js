export const isArcanasEnabled = () =>
  import.meta.env.VITE_MODULE_ARCANAS !== "false";

export const isAgentsEnabled = () =>
  import.meta.env.VITE_MODULE_AGENTS !== "false";

