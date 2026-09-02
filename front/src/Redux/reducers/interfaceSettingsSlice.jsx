import { createSlice } from "@reduxjs/toolkit";

const interfaceSettingsSlice = createSlice({
  name: "interface_settings",
  initialState: {
    dark_mode: false,
    show_sidebar: true,
    show_settings: false,
    warn_clear_history: true,
    // warn_clear_memory: true,
    warn_share_settings: true,
    show_tour: true,
    count_hallucination: 0,
    count_announcement: 0,
    agree_web_search: false,
    show_usage_in_sidebar: true,
    collapsed_topics: [],
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
    toggleTopic: (state, action) => {
      if (state.collapsed_topics.includes(action.payload)) {
        state.collapsed_topics = state.collapsed_topics.filter(
          (topic) => topic !== action.payload
        );
      } else {
        state.collapsed_topics.push(action.payload);
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
export const selectCollapsedTopics = (state) => state.interface_settings.collapsed_topics;
export const {
  toggleTheme, setDarkMode, setLightMode,
  closeSettings, toggleSettings, toggleSidebar, closeSidebar, openSidebar,
  closeAnnouncement, closeHallucination, agreeWebSearch, closeTour,
  setShowUsageInSidebar, toggleTopic,
} = interfaceSettingsSlice.actions;
export default interfaceSettingsSlice.reducer;
