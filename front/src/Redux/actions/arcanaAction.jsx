import { createAction } from "@reduxjs/toolkit";

// Creating action creators
export const setItem = createAction("SET_ITEM");
export const setIcon = createAction("SET_ICON");
export const setTitle = createAction("SET_TITLE");
export const setDescription = createAction("SET_DESCRIPTION");
export const setFiles = createAction("SET_FILES");
export const deleteArcana = createAction("DELETE_ARCANA", (id) => ({
  payload: { id },
}));
export const resetArcanas = createAction("RESET_ARCANAS");
