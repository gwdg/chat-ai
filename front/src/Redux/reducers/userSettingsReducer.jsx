// userMemorySlice.js
import { createSlice } from "@reduxjs/toolkit";

// off: show code only · static: preview without scripts · ask: static
// preview plus a per-block "Run" button
export const HTML_PREVIEW_MODES = ["off", "static", "ask"];

const initialState = {
  memories: [],
  timeout: 300000,
  memory_mode: 0,
  suggest_user_prompts: false,
  html_preview: "static",
  set_title_once: true,
  render_typst: true,
  render_latex: true,
  document_conversion_mode: "browser",
};

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

    setHtmlPreview: (state, action) => {
      if (HTML_PREVIEW_MODES.includes(action.payload)) {
        state.html_preview = action.payload;
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
      if (["server", "browser"].includes(mode)) {
        state.document_conversion_mode = mode;
      }
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
  setDefaultModel, setMemoryMode, setSuggestUserPrompts, setHtmlPreview,
  setSetTitleOnce, setRenderTypst, setRenderLatex, setDocumentConversionMode
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
export const selectHtmlPreview = (state) => {
  const mode = state.user_settings.html_preview;
  return HTML_PREVIEW_MODES.includes(mode) ? mode : "static";
};
export const selectSetTitleOnce = (state) =>
  state.user_settings.set_title_once ?? true;
export const selectRenderTypst = (state) =>
  state.user_settings.render_typst ?? true;
export const selectRenderLatex = (state) =>
  state.user_settings.render_latex ?? true;
export const selectDocumentConversionMode = (state) => {
  const mode = state.user_settings.document_conversion_mode;
  // The former per-document "choice" mode now reads as browser.
  return mode === "server" ? "server" : "browser";
};
export const selectUserSettings = (state) => state.user_settings;
export default userSettingsSlice.reducer;
