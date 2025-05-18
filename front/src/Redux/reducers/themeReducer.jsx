// themeReducer.js
import { createSlice } from "@reduxjs/toolkit";

const themeSlice = createSlice({
  name: "theme",
  initialState: { isDarkMode: false },
  reducers: {
    toggleTheme: (state) => {
      state.isDarkMode = !state.isDarkMode;
    },
    setDarkMode: (state) => {
      state.isDarkMode = true;
    },
    setLightMode: (state) => {
      state.isDarkMode = false;
    },
  },
});

export const { toggleTheme, setDarkMode, setLightMode } = themeSlice.actions;
export default themeSlice.reducer;
