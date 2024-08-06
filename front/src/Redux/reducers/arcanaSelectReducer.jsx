// selectedArcanaReducer.js
import { createReducer } from "@reduxjs/toolkit";
import { setSelectedArcana } from "../actions/arcanaSelectAction";

const initialState = 0; // 0 represents no selection, 1 represents the first arcana, etc.

const selectedArcanaReducer = createReducer(initialState, (builder) => {
  builder.addCase(setSelectedArcana, (state, action) => {
    return action.payload;
  });
});

export default selectedArcanaReducer;
