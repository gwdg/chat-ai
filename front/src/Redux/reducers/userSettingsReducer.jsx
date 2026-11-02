// userMemorySlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  memories: [],
  timeout: 300000,
  memory_mode: 0,
  suggest_user_prompts: false,
  html_render_mode: "off",
  html_load_external: false,
  html_sanitization: "strict",
  set_title_once: true,
  render_typst: false,
  render_latex: false,
  document_conversion_mode: "choice",
  conversation_summaries: true,
};

const MEMORY_MODES = [0, 1, 2];
const RENDER_MODES = ["render", "code", "off"];
const SANITIZATION_MODES = ["strict", "relaxed"];
const DOCUMENT_CONVERSION_MODES = ["server", "browser", "choice"];

// Apply settings from an exported backup without trusting arbitrary fields.
function importUserSettingsState(state, incoming) {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return;
  if (Array.isArray(incoming.memories)) {
    state.memories = incoming.memories
      .filter((memory) => memory && typeof memory === "object")
      .map((memory) => ({ ...memory }));
  }
  const timeout = Number(incoming.timeout);
  if (Number.isFinite(timeout)) {
    state.timeout = Math.min(Math.max(timeout, 5000), 900000);
  }
  const memoryMode = Number(incoming.memory_mode);
  if (MEMORY_MODES.includes(memoryMode)) state.memory_mode = memoryMode;
  if (RENDER_MODES.includes(incoming.html_render_mode)) {
    state.html_render_mode = incoming.html_render_mode;
  }
  if (SANITIZATION_MODES.includes(incoming.html_sanitization)) {
    state.html_sanitization = incoming.html_sanitization;
  }
  if (DOCUMENT_CONVERSION_MODES.includes(incoming.document_conversion_mode)) {
    state.document_conversion_mode = incoming.document_conversion_mode;
  } else if (typeof incoming.browser_document_conversion === "boolean") {
    // Pre-v5 export shape.
    state.document_conversion_mode = incoming.browser_document_conversion ? "choice" : "server";
  }
  for (const key of [
    "suggest_user_prompts",
    "html_load_external",
    "set_title_once",
    "render_typst",
    "render_latex",
    "conversation_summaries",
  ]) {
    if (typeof incoming[key] === "boolean") state[key] = incoming[key];
  }
  if (incoming.model !== undefined) state.model = incoming.model;
}

const userSettingsSlice = createSlice({
  name: "user_settings",
  initialState,
  reducers: {
    // Add new memory
    addMemory: (state, action) => {
      const { text } = action.payload;
      const newMemory = {
        id: state.nextId,
        text: text.trim(),
        createdAt: new Date().toISOString(),
      };

      state.memories.push(newMemory);
      state.nextId += 1;
    },

    // Edit existing memory
    editMemory: (state, action) => {
      const { index, text } = action.payload;

      if (index >= 0 && index < state.memories.length) {
        state.memories[index].text = text.trim();
      }
    },

    // Delete single memory
    deleteMemory: (state, action) => {
      const { index } = action.payload;

      if (index >= 0 && index < state.memories.length) {
        state.memories.splice(index, 1);
      }
    },

    // Delete all memories
    deleteAllMemories: (state) => {
      state.memories = [];
    },

    // Set default model
    setDefaultModel: (state, action) => {
      state.model = action.payload;
    },

    setMemoryMode: (state, action) => {
      const memoryMode = Number(action.payload);
      if ([0, 1, 2].includes(memoryMode)) {
        state.memory_mode = memoryMode;
      }
    },

    setSuggestUserPrompts: (state, action) => {
      state.suggest_user_prompts = Boolean(action.payload);
    },

    setHtmlRenderMode: (state, action) => {
      const mode = action.payload;
      if (["render", "code", "off"].includes(mode)) {
        state.html_render_mode = mode;
      }
    },

    setHtmlLoadExternal: (state, action) => {
      state.html_load_external = Boolean(action.payload);
    },

    setHtmlSanitization: (state, action) => {
      const mode = action.payload;
      if (["strict", "relaxed"].includes(mode)) {
        state.html_sanitization = mode;
      }
    },

    setSetTitleOnce: (state, action) => {
      state.set_title_once = Boolean(action.payload);
    },

    setRenderTypst: (state, action) => {
      state.render_typst = Boolean(action.payload);
    },

    setRenderLatex: (state, action) => {
      state.render_latex = Boolean(action.payload);
    },

    setDocumentConversionMode: (state, action) => {
      const mode = action.payload;
      if (["server", "browser", "choice"].includes(mode)) {
        state.document_conversion_mode = mode;
      }
    },

    setConversationSummaries: (state, action) => {
      state.conversation_summaries = Boolean(action.payload);
    },

    importUserSettings: (state, action) => {
      importUserSettingsState(state, action.payload);
    },

    // Timeout
    setTimeoutTime: (state, action) => {
      // Validate timeout range (5 seconds to 15 minutes)
      const timeout = Math.min(Math.max(action.payload, 5000), 900000);
      state.timeout = timeout;
    },
    resetTimeoutTime: (state) => {
      state.timeout = 300000; // Reset to default 5 minutes
    },
    setTimeoutInSeconds: (state, action) => {
      // Helper to set timeout in seconds instead of milliseconds
      const timeoutInMs = Math.min(
        Math.max(action.payload * 1000, 5000),
        900000
      );
      state.timeout = timeoutInMs;
    },
  },
});

export const {
  addMemory, editMemory, deleteMemory, deleteAllMemories,
  setTimeoutTime, resetTimeoutTime, setTimeoutInSeconds,
  setDefaultModel, setMemoryMode, setSuggestUserPrompts, setHtmlRenderMode,
  setHtmlLoadExternal, setHtmlSanitization, setSetTitleOnce, setRenderTypst,
  setRenderLatex, setDocumentConversionMode, setConversationSummaries,
  importUserSettings
} = userSettingsSlice.actions;

// Selectors
export const selectAllMemories = (state) => state.user_settings.memories;
export const selectTimeout = (state) => state.user_settings.timeout;
export const selectDefaultModel = (state) => state.user_settings.model;
export const selectMemoryMode = (state) => {
  const memoryMode = state.user_settings.memory_mode;
  return [0, 1, 2].includes(memoryMode) ? memoryMode : 0;
};
export const selectSuggestUserPrompts = (state) =>
  state.user_settings.suggest_user_prompts ?? false;
export const selectHtmlRenderMode = (state) => {
  const mode = state.user_settings.html_render_mode;
  return ["render", "code", "off"].includes(mode) ? mode : "off";
};
export const selectHtmlLoadExternal = (state) =>
  state.user_settings.html_load_external ?? false;
export const selectHtmlSanitization = (state) => {
  const mode = state.user_settings.html_sanitization;
  return ["strict", "relaxed"].includes(mode) ? mode : "strict";
};
export const selectSetTitleOnce = (state) =>
  state.user_settings.set_title_once ?? true;
export const selectRenderTypst = (state) =>
  state.user_settings.render_typst ?? false;
export const selectRenderLatex = (state) =>
  state.user_settings.render_latex ?? false;
export const selectDocumentConversionMode = (state) => {
  const mode = state.user_settings.document_conversion_mode;
  return ["server", "browser", "choice"].includes(mode) ? mode : "choice";
};
export const selectConversationSummaries = (state) =>
  state.user_settings.conversation_summaries ?? true;
export const selectUserSettings = (state) => state.user_settings;
export default userSettingsSlice.reducer;
