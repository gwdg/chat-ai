import { moduleValue } from "../config/deployment.js";

// Deployment profiles may override the modules from secrets/front.json; when
// they do not, the documented defaults apply:
//   tools / feedback / choices: opt-in      ("true" enables)
//   agent / agents / arcanas:   opt-out     (anything but "false" enables)
//   speech:                     a value     ("browser" or a {model, voice} object)
//
// `scripts/validate-feature-guides.mjs` imports featureGuides in plain Node,
// which reaches this module; `import.meta.env` does not exist there. Vite still
// replaces the object at build time.
const env = import.meta.env || {};

export const isArcanasEnabled = () =>
  Boolean(moduleValue("arcanas", env.VITE_MODULE_ARCANAS !== "false"));

export const isAgentsEnabled = () =>
  Boolean(moduleValue("agents", env.VITE_MODULE_AGENTS !== "false"));

export const isToolsEnabled = () =>
  Boolean(moduleValue("tools", env.VITE_MODULE_TOOLS === "true"));

export const isFeedbackEnabled = () =>
  Boolean(moduleValue("feedback", env.VITE_MODULE_FEEDBACK === "true"));

export const isChoicesEnabled = () =>
  Boolean(moduleValue("choices", env.VITE_MODULE_CHOICES === "true"));

export const isAgentEnabled = () =>
  Boolean(moduleValue("agent", env.VITE_MODULE_AGENT !== "false"));

export const speechModuleValue = () => moduleValue("speech", env.VITE_MODULE_SPEECH);
// Encrypted sync over the user's SAIA filesystem is opt-in: a deployment has to
// enable the module, and the user has to switch the server copy on.
export const isSyncEnabled = () =>
  Boolean(moduleValue("sync", env.VITE_MODULE_SYNC === "true"));
