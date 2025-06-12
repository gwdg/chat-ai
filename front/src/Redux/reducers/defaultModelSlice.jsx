import { createSlice } from "@reduxjs/toolkit";
import { getDefaultSettings } from "../../utils/settingsUtils";

// Get default model info from settings utility
const getDefaultModelInfo = () => {
  const defaultSettings = getDefaultSettings();
  return {
    name: defaultSettings["model-name"],
    id: defaultSettings.model,
  };
};

const initialState = getDefaultModelInfo();

const defaultModelSlice = createSlice({
  name: "defaultModel",
  initialState,
  reducers: {
    setDefaultModel: (state, action) => {
      // action.payload should contain { name, id } from the selected model
      state.name = action.payload.name;
      state.id = action.payload.id;
    },
    resetDefaultModel: (state) => {
      const defaultModel = getDefaultModelInfo();
      state.name = defaultModel.name;
      state.id = defaultModel.id;
    },
  },
});

// Selectors
export const selectDefaultModel = (state) => state.defaultModel;
export const selectDefaultModelName = (state) => state.defaultModel.name;
export const selectDefaultModelId = (state) => state.defaultModel.id;

export const { setDefaultModel, resetDefaultModel } = defaultModelSlice.actions;

export default defaultModelSlice.reducer;
