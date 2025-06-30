// userMemorySlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  memories: [],
  nextId: 1,
};

const userMemorySlice = createSlice({
  name: "userMemory",
  initialState,
  reducers: {
    // Add new memory
    addMemory: (state, action) => {
      const { text } = action.payload;
      const newMemory = {
        id: state.nextId,
        text: text.trim(),
        createdAt: new Date().toISOString(),
      };

      state.memories.push(newMemory);
      state.nextId += 1;
    },

    // Edit existing memory
    editMemory: (state, action) => {
      const { index, text } = action.payload;

      if (index >= 0 && index < state.memories.length) {
        state.memories[index].text = text.trim();
      }
    },

    // Delete single memory
    deleteMemory: (state, action) => {
      const { index } = action.payload;

      if (index >= 0 && index < state.memories.length) {
        state.memories.splice(index, 1);
      }
    },

    // Delete all memories
    deleteAllMemories: (state) => {
      state.memories = [];
      state.nextId = 1;
    },
  },
});

export const { addMemory, editMemory, deleteMemory, deleteAllMemories } =
  userMemorySlice.actions;

// Selectors
export const selectAllMemories = (state) => state.userMemory.memories;
export const selectMemoryByIndex = (state, index) =>
  state.userMemory.memories[index];

export default userMemorySlice.reducer;
