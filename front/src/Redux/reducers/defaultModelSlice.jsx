import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  name: "Meta Llama 3.1 8B Instruct",
  id: "meta-llama-3.1-8b-instruct",
};

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
      state.name = "Meta Llama 3.1 8B Instruct";
      state.id = "meta-llama-3.1-8b-instruct";
    },
  },
});

// Selectors
export const selectDefaultModel = (state) => state.defaultModel;
export const selectDefaultModelName = (state) => state.defaultModel.name;
export const selectDefaultModelId = (state) => state.defaultModel.id;

export const { setDefaultModel, resetDefaultModel } = defaultModelSlice.actions;

export default defaultModelSlice.reducer;
