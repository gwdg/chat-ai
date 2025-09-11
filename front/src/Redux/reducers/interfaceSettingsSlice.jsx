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
    count_hallucination: 0,
    count_announcement: 0,
    agree_web_search: false,
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
    toggleSidebar: (state) => {
      state.show_sidebar = !state.show_sidebar;
    },
    closeSettings: (state) => {
      state.show_settings = false;
    },
    toggleSettings: (state) => {
      state.show_settings = !state.show_settings;
    },
    setDarkMode: (state) => {
      state.dark_mode = true;
    },
    setLightMode: (state) => {
      state.dark_mode = false;
    },
    closeHallucination: (state) => {
      state.count_hallucination += 1;
    },
    closeAnnouncement: (state) => {
      state.count_announcement += 1;
    },
    agreeWebSearch: (state) => {
      state.agree_web_search = true;
    }
  },
});

export const selectDarkMode = (state) => state.interface_settings.dark_mode;
export const selectShowSettings = (state) => state.interface_settings.show_settings;
export const selectShowSidebar = (state) => state.interface_settings.show_sidebar;
export const selectCountHallucination = (state) => state.interface_settings.count_hallucination;
export const selectCountAnnouncement = (state) => state.interface_settings.count_announcement;
export const selectAgreeWebSearch = (state) => state.interface_settings.agree_web_search;
export const { 
  toggleTheme, setDarkMode, setLightMode,
  closeSettings, toggleSettings, toggleSidebar, closeSidebar, openSidebar,
  closeAnnouncement, closeHallucination, agreeWebSearch,
 } = interfaceSettingsSlice.actions;
export default interfaceSettingsSlice.reducer;
