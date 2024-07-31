import { createReducer } from "@reduxjs/toolkit";
import {
  setItem,
  setIcon,
  setTitle,
  setDescription,
  setFiles,
  deleteArcana,
  resetArcanas,
} from "../actions/arcanaAction";

const initialState = [
  { id: 1, icon: "", title: "", description: "", files: [] },
  { id: 2, icon: "", title: "", description: "", files: [] },
  { id: 3, icon: "", title: "", description: "", files: [] },
];

const arcanaReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(setItem, (state, action) => {
      const { index, data } = action.payload;
      if (state[index]) {
        state[index] = { ...state[index], ...data };
      }
    })
    .addCase(setIcon, (state, action) => {
      const { index, icon } = action.payload;
      if (state[index]) {
        state[index].icon = icon;
      }
    })
    .addCase(setTitle, (state, action) => {
      const { index, title } = action.payload;
      if (state[index]) {
        state[index].title = title;
      }
    })
    .addCase(setDescription, (state, action) => {
      const { index, description } = action.payload;
      if (state[index]) {
        state[index].description = description;
      }
    })
    .addCase(setFiles, (state, action) => {
      const { index, files } = action.payload;
      if (state[index]) {
        state[index].files = files;
      }
    })
    .addCase(deleteArcana, (state, action) => {
      const { id } = action.payload;
      return state.filter((arcana) => arcana.id !== id);
    })
    .addCase(resetArcanas, () => initialState);
});

export default arcanaReducer;
