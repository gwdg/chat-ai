// userMemorySlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  memories: [],
  memory_groups: [],
  default_memory_group: "default",
  mcp_servers: [],
  timeout: 300000,
  memory_mode: 0,
  suggest_user_prompts: false,
  html_render_mode: "off",
  html_load_external: false,
  html_sanitization: "strict",
  set_title_once: true,
  render_typst: false,
  render_latex: false,
  render_graphviz: false,
  render_vega: false,
  render_chartjs: false,
  collapse_reasoning_while_streaming: true,
  document_conversion_mode: "choice",
  conversation_summaries: true,
  show_timestamps: false,
  // null = device default (Enter on desktop, Shift+Enter on mobile).
  send_with_enter: null,
};

const MEMORY_MODES = [0, 1, 2];
const RENDER_MODES = ["render", "code", "off"];
const SANITIZATION_MODES = ["strict", "relaxed"];
const DOCUMENT_CONVERSION_MODES = ["server", "browser", "choice"];

function ensureMemoryState(state) {
  if (!Array.isArray(state.memories)) state.memories = [];
  if (!Array.isArray(state.memory_groups)) state.memory_groups = [];
  if (typeof state.default_memory_group !== "string") {
    state.default_memory_group = "default";
  }
}

// Apply settings from an exported backup without trusting arbitrary fields.
function importUserSettingsState(state, incoming) {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return;
  ensureMemoryState(state);
  if (Array.isArray(incoming.memories)) {
    state.memories = incoming.memories
      .filter((memory) => memory && typeof memory === "object")
      .map((memory) => ({ ...memory }));
  }
  if (Array.isArray(incoming.memory_groups)) {
    state.memory_groups = incoming.memory_groups
      .filter(
        (group) =>
          group &&
          typeof group.id === "string" &&
          group.id !== "default" &&
          typeof group.name === "string" &&
          group.name.trim(),
      )
      .map((group) => ({ id: group.id, name: group.name.trim() }));
  }
  if (typeof incoming.default_memory_group === "string") {
    state.default_memory_group =
      incoming.default_memory_group === "default" ||
      state.memory_groups.some(
        (group) => group.id === incoming.default_memory_group,
      )
        ? incoming.default_memory_group
        : "default";
  }
  const validGroupIds = new Set([
    "default",
    ...state.memory_groups.map((group) => group.id),
  ]);
  state.memories = state.memories.map((memory) => {
    const groupId = memory.groupId ?? "default";
    return {
      ...memory,
      groupId: validGroupIds.has(groupId) ? groupId : "default",
    };
  });
  if (Array.isArray(incoming.mcp_servers)) {
    state.mcp_servers = incoming.mcp_servers
      .filter(
        (server) =>
          server &&
          typeof server.id === "string" &&
          (server.kind === "local" || server.kind === "remote") &&
          typeof (server.kind === "local" ? server.url : server.serverId) ===
            "string" &&
          String(
            server.kind === "local" ? server.url : server.serverId,
          ).trim(),
      )
      .map((server) => ({
        id: server.id,
        name: typeof server.name === "string" ? server.name : undefined,
        kind: server.kind,
        url: server.kind === "local" ? server.url.trim() : undefined,
        serverId:
          server.kind === "remote" ? server.serverId.trim() : undefined,
        ...(server.headers && typeof server.headers === "object"
          ? { headers: { ...server.headers } }
          : {}),
      }));
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
    state.document_conversion_mode = incoming.browser_document_conversion ? "choice" : "server";
  }
  for (const key of [
    "suggest_user_prompts",
    "html_load_external",
    "set_title_once",
    "render_typst",
    "render_latex",
    "render_graphviz",
    "render_vega",
    "render_chartjs",
    "collapse_reasoning_while_streaming",
    "conversation_summaries",
    "show_timestamps",
  ]) {
    if (typeof incoming[key] === "boolean") state[key] = incoming[key];
  }
  if (typeof incoming.send_with_enter === "boolean" || incoming.send_with_enter === null) {
    state.send_with_enter = incoming.send_with_enter;
  }
  if (incoming.model !== undefined) state.model = incoming.model;
}

const userSettingsSlice = createSlice({
  name: "user_settings",
  initialState,
  reducers: {
    // Add new memory
    addMemory: (state, action) => {
      ensureMemoryState(state);
      const { text, groupId } = action.payload;
      const group =
        typeof groupId === "string" &&
        (groupId === "default" ||
          state.memory_groups.some((item) => item.id === groupId))
          ? groupId
          : "default";
      const newMemory = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `mem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        groupId: group,
      };

      state.memories.push(newMemory);
    },

    // Edit existing memory
    editMemory: (state, action) => {
      const { index, text, groupId } = action.payload;

      if (typeof groupId === "string") {
        const groupMemories = state.memories.filter(
          (memory) => (memory.groupId ?? "default") === groupId,
        );
        if (index >= 0 && index < groupMemories.length) {
          groupMemories[index].text = text.trim();
        }
        return;
      }

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

    addMemoryGroup: (state, action) => {
      ensureMemoryState(state);
      const { id, name } = action.payload || {};
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!id || id === "default" || !trimmed) return;
      if (state.memory_groups.some((group) => group.id === id)) return;
      if (
        state.memory_groups.some(
          (group) => group.name.toLowerCase() === trimmed.toLowerCase(),
        )
      ) {
        return;
      }
      state.memory_groups.push({ id, name: trimmed });
    },

    renameMemoryGroup: (state, action) => {
      ensureMemoryState(state);
      const { id, name } = action.payload || {};
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!id || !trimmed) return;
      const group = state.memory_groups.find((item) => item.id === id);
      if (!group) return;
      if (
        state.memory_groups.some(
          (item) =>
            item.id !== id &&
            item.name.toLowerCase() === trimmed.toLowerCase(),
        )
      ) {
        return;
      }
      group.name = trimmed;
    },

    deleteMemoryGroup: (state, action) => {
      ensureMemoryState(state);
      const { id } = action.payload || {};
      if (!id || id === "default") return;
      state.memory_groups = state.memory_groups.filter(
        (group) => group.id !== id,
      );
      state.memories = state.memories.map((memory) =>
        (memory.groupId ?? "default") === id
          ? { ...memory, groupId: "default" }
          : memory,
      );
      if (state.default_memory_group === id) {
        state.default_memory_group = "default";
      }
    },

    setDefaultMemoryGroup: (state, action) => {
      ensureMemoryState(state);
      const id = action.payload;
      if (
        id === "default" ||
        state.memory_groups.some((group) => group.id === id)
      ) {
        state.default_memory_group = id;
      }
    },

    setMemoryGroup: (state, action) => {
      ensureMemoryState(state);
      const { index, groupId } = action.payload || {};
      if (index < 0 || index >= state.memories.length) return;
      state.memories[index].groupId =
        typeof groupId === "string" &&
        (groupId === "default" ||
          state.memory_groups.some((group) => group.id === groupId))
          ? groupId
          : "default";
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

    setRenderGraphviz: (state, action) => {
      state.render_graphviz = Boolean(action.payload);
    },

    setRenderVega: (state, action) => {
      state.render_vega = Boolean(action.payload);
    },

    setRenderChartjs: (state, action) => {
      state.render_chartjs = Boolean(action.payload);
    },

    setCollapseReasoningWhileStreaming: (state, action) => {
      state.collapse_reasoning_while_streaming = Boolean(action.payload);
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

    setShowTimestamps: (state, action) => {
      state.show_timestamps = Boolean(action.payload);
    },

    setSendWithEnter: (state, action) => {
      state.send_with_enter = Boolean(action.payload);
    },

    addMcpServer: (state, action) => {
      if (!Array.isArray(state.mcp_servers)) state.mcp_servers = [];
      const server = action.payload;
      if (!server?.id || !server?.kind) return;
      if (state.mcp_servers.some((item) => item.id === server.id)) return;
      state.mcp_servers.push(server);
    },
    updateMcpServer: (state, action) => {
      if (!Array.isArray(state.mcp_servers)) state.mcp_servers = [];
      const { id, patch } = action.payload || {};
      const index = state.mcp_servers.findIndex((item) => item.id === id);
      if (index >= 0 && patch) state.mcp_servers[index] = {
        ...state.mcp_servers[index],
        ...patch,
        id,
      };
    },
    removeMcpServer: (state, action) => {
      if (!Array.isArray(state.mcp_servers)) state.mcp_servers = [];
      state.mcp_servers = state.mcp_servers.filter(
        (item) => item.id !== action.payload,
      );
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
  addMemoryGroup, renameMemoryGroup, deleteMemoryGroup,
  setDefaultMemoryGroup, setMemoryGroup,
  addMcpServer, updateMcpServer, removeMcpServer,
  setTimeoutTime, resetTimeoutTime, setTimeoutInSeconds,
  setDefaultModel, setMemoryMode, setSuggestUserPrompts, setHtmlRenderMode,
  setHtmlLoadExternal, setHtmlSanitization, setSetTitleOnce, setRenderTypst,
  setRenderLatex, setRenderGraphviz, setRenderVega, setRenderChartjs,
  setCollapseReasoningWhileStreaming, setDocumentConversionMode,
  setConversationSummaries, setShowTimestamps,
  setSendWithEnter, importUserSettings
} = userSettingsSlice.actions;

// Selectors
export const selectAllMemories = (state) => state.user_settings.memories;
export const selectGlobalMcpServers = (state) =>
  state.user_settings.mcp_servers ?? [];
export const selectMemoryGroups = (state) =>
  state.user_settings.memory_groups ?? [];
export const selectDefaultMemoryGroup = (state) =>
  state.user_settings.default_memory_group ?? "default";
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
export const selectRenderGraphviz = (state) =>
  state.user_settings.render_graphviz ?? false;
export const selectRenderVega = (state) =>
  state.user_settings.render_vega ?? false;
export const selectRenderChartjs = (state) =>
  state.user_settings.render_chartjs ?? false;
export const selectCollapseReasoningWhileStreaming = (state) =>
  state.user_settings.collapse_reasoning_while_streaming ?? true;
export const selectDocumentConversionMode = (state) => {
  const mode = state.user_settings.document_conversion_mode;
  return ["server", "browser", "choice"].includes(mode) ? mode : "choice";
};
export const selectConversationSummaries = (state) =>
  state.user_settings.conversation_summaries ?? true;
export const selectShowTimestamps = (state) =>
  state.user_settings.show_timestamps ?? false;
// null means "use the device default", resolved in the prompt component.
export const selectSendWithEnter = (state) =>
  state.user_settings.send_with_enter ?? null;
export const selectUserSettings = (state) => state.user_settings;
export default userSettingsSlice.reducer;
