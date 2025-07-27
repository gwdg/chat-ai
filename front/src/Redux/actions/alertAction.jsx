import { createAction, createReducer } from "@reduxjs/toolkit";

// Action
export const setCountGlobal = createAction("SET_COUNT");

// Initial state
const initialState = 0;

// Reducer
const alertReducer = createReducer(initialState, (builder) => {
  builder.addCase(setCountGlobal, (state, action) => {
    return action.payload;
  });
});

export default alertReducer;
