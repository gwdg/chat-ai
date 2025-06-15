// timeoutReducer.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  timeoutTime: 30000, // Default 30 seconds in milliseconds
};

const timeoutSlice = createSlice({
  name: "timeout",
  initialState,
  reducers: {
    setTimeoutTime: (state, action) => {
      // Validate timeout range (5 seconds to 5 minutes)
      const timeout = Math.min(Math.max(action.payload, 5000), 300000);
      state.timeoutTime = timeout;
    },
    resetTimeoutTime: (state) => {
      state.timeoutTime = 30000; // Reset to default 30 seconds
    },
    setTimeoutInSeconds: (state, action) => {
      // Helper to set timeout in seconds instead of milliseconds
      const timeoutInMs = Math.min(
        Math.max(action.payload * 1000, 5000),
        300000
      );
      state.timeoutTime = timeoutInMs;
    },
  },
});

export const { setTimeoutTime, resetTimeoutTime, setTimeoutInSeconds } =
  timeoutSlice.actions;
export default timeoutSlice.reducer;
