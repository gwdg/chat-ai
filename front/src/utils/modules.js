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

// Speech carries a value rather than a boolean: `"browser"` (or the older `true`)
// enables it with the browser's own voices, an object names an engine TTS model.
// `utils/speechAudio.js#getSpeechModule` reads the same value for the UI; both go
// through this one parser, which keeps `scripts/validate-feature-guides.mjs`
// working in plain Node.
export function normalizeSpeechModule(raw) {
  if (!raw || raw === "undefined" || raw === "false") return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed === "browser" || parsed === true) {
      return { model: null, voice: null };
    }
    if (parsed && typeof parsed === "object" && parsed.model && parsed.voice) {
      return parsed;
    }
  } catch (error) {
    console.warn("Could not parse the speech module configuration.", error);
  }
  return null;
}

export const isSpeechEnabled = () =>
  Boolean(normalizeSpeechModule(speechModuleValue()));
// Encrypted sync over the user's SAIA filesystem is opt-in: a deployment has to
// enable the module, and the user has to switch the server synchronization on.
export const isSyncEnabled = () =>
  Boolean(moduleValue("sync", env.VITE_MODULE_SYNC === "true"));
