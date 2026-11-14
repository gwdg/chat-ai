import { createSlice } from "@reduxjs/toolkit";

const interfaceSettingsSlice = createSlice({
  name: "interface_settings",
  initialState: {
    dark_mode: false,
    show_sidebar: true,
    show_settings: false,
    warn_clear_history: true,
    warn_close_chat: true,
    warn_share_settings: true,
    warn_regenerate: true,
    warn_fork: true,
    warn_workspace_delete: true,
    show_tour: true,
    count_hallucination: 0,
    count_announcement: 0,
    agree_web_search: false,
    show_usage_in_sidebar: true,
    collapsed_topics: [],
    conversation_sort: "created_desc",
    conversation_grouping: "topic",
    completed_tutorials: [],
    completed_use_cases: [],
    suppressed_tutorials: [],
  },
  reducers: {
    toggleTheme: (state) => {
      state.dark_mode = !state.dark_mode;
    },
    openSidebar: (state) => {
      state.show_sidebar = true;
    },
    closeSidebar: (state) => {
      state.show_sidebar = false;
    },
    toggleSidebar: (state, action) => {
      state.show_sidebar = action.payload !== undefined ? action.payload : !state.show_sidebar;
    },
    closeSettings: (state) => {
      state.show_settings = false;
    },
    toggleSettings: (state, action) => {
      state.show_settings = action.payload !== undefined ? action.payload : !state.show_settings;
    },
    setDarkMode: (state) => {
      state.dark_mode = true;
    },
    setLightMode: (state) => {
      state.dark_mode = false;
    },
    closeTour: (state) => {
      state.show_tour = false;
    },
    closeHallucination: (state) => {
      state.count_hallucination += 1;
    },
    closeAnnouncement: (state) => {
      state.count_announcement += 1;
    },
    agreeWebSearch: (state) => {
      state.agree_web_search = true;
    },
    setShowUsageInSidebar: (state, action) => {
      state.show_usage_in_sidebar = Boolean(action.payload);
    },
    // Enable or disable one of the warn_* confirmation dialogs, e.g. when the
    // user dismisses it with "don't show this again".
    setWarning: (state, action) => {
      const { key, value } = action.payload;
      state[key] = Boolean(value);
    },
    toggleTopic: (state, action) => {
      if (state.collapsed_topics.includes(action.payload)) {
        state.collapsed_topics = state.collapsed_topics.filter(
          (topic) => topic !== action.payload
        );
      } else {
        state.collapsed_topics.push(action.payload);
      }
    },
    collapseTopics: (state, action) => {
      const ids = Array.isArray(action.payload)
        ? action.payload
        : [action.payload];
      for (const id of ids) {
        if (id && !state.collapsed_topics.includes(id)) {
          state.collapsed_topics.push(id);
        }
      }
    },
    setConversationSort: (state, action) => {
      state.conversation_sort = action.payload;
    },
    setConversationGrouping: (state, action) => {
      if (["topic", "date", "created", "size"].includes(action.payload)) {
        state.conversation_grouping = action.payload;
      }
    },
    markTutorialCompleted: (state, action) => {
      if (!action.payload) return;
      if (!Array.isArray(state.completed_tutorials)) {
        state.completed_tutorials = [];
      }
      if (!state.completed_tutorials.includes(action.payload)) {
        state.completed_tutorials.push(action.payload);
      }
    },
    markUseCaseCompleted: (state, action) => {
      if (!action.payload) return;
      if (!Array.isArray(state.completed_use_cases)) {
        state.completed_use_cases = [];
      }
      if (!state.completed_use_cases.includes(action.payload)) {
        state.completed_use_cases.push(action.payload);
      }
    },
    suppressTutorial: (state, action) => {
      if (!action.payload) return;
      if (!Array.isArray(state.suppressed_tutorials)) {
        state.suppressed_tutorials = [];
      }
      if (!state.suppressed_tutorials.includes(action.payload)) {
        state.suppressed_tutorials.push(action.payload);
      }
    },
  },
});

export const selectDarkMode = (state) => state.interface_settings.dark_mode;
export const selectShowSettings = (state) => state.interface_settings.show_settings;
export const selectShowSidebar = (state) => state.interface_settings.show_sidebar;
export const selectCountHallucination = (state) => state.interface_settings.count_hallucination;
export const selectCountAnnouncement = (state) => state.interface_settings.count_announcement;
export const selectAgreeWebSearch = (state) => state.interface_settings.agree_web_search;
export const selectShowTour = (state) => state.interface_settings.show_tour;
export const selectShowUsageInSidebar = (state) =>
  state.interface_settings.show_usage_in_sidebar ?? true;
// Warnings default to shown, so anything unknown counts as enabled.
export const selectWarning = (key) => (state) =>
  state.interface_settings[key] ?? true;
export const selectCollapsedTopics = (state) => state.interface_settings.collapsed_topics;
export const selectConversationSort = (state) =>
  state.interface_settings.conversation_sort ?? "created_desc";
export const selectConversationGrouping = (state) => {
  const grouping = state.interface_settings.conversation_grouping;
  return ["date", "created", "size"].includes(grouping) ? grouping : "topic";
};
// Stable empty arrays keep useSelector from reporting a new snapshot for old,
// persisted state that predates these lists.
const EMPTY_LIST = [];
export const selectCompletedTutorials = (state) =>
  state.interface_settings.completed_tutorials ?? EMPTY_LIST;
export const selectCompletedUseCases = (state) =>
  state.interface_settings.completed_use_cases ?? EMPTY_LIST;
export const selectSuppressedTutorials = (state) =>
  state.interface_settings.suppressed_tutorials ?? EMPTY_LIST;
export const {
  toggleTheme, setDarkMode, setLightMode,
  closeSettings, toggleSettings, toggleSidebar, closeSidebar, openSidebar,
  closeAnnouncement, closeHallucination, agreeWebSearch, closeTour,
  setShowUsageInSidebar, setWarning, toggleTopic, collapseTopics,
  setConversationSort, setConversationGrouping, markTutorialCompleted, markUseCaseCompleted,
  suppressTutorial,
} = interfaceSettingsSlice.actions;
export default interfaceSettingsSlice.reducer;
