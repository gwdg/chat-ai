// userMemorySlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  memories: [],
  timeout: 300000,
  memory_mode: 0,
  suggest_user_prompts: false,
  html_render_mode: "render",
  html_load_external: true,
  html_sanitization: "strict",
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
  setHtmlLoadExternal, setHtmlSanitization
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
  return ["render", "code", "off"].includes(mode) ? mode : "render";
};
export const selectHtmlLoadExternal = (state) =>
  state.user_settings.html_load_external ?? true;
export const selectHtmlSanitization = (state) => {
  const mode = state.user_settings.html_sanitization;
  return ["strict", "relaxed"].includes(mode) ? mode : "strict";
};
export const selectUserSettings = (state) => state.user_settings;
export default userSettingsSlice.reducer;
