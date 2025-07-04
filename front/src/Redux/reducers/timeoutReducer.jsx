// timeoutReducer.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  timeoutTime: 300000, // Default 5 minutes in milliseconds
};

const timeoutSlice = createSlice({
  name: "timeout",
  initialState,
  reducers: {
    setTimeoutTime: (state, action) => {
      // Validate timeout range (5 seconds to 15 minutes)
      const timeout = Math.min(Math.max(action.payload, 5000), 900000);
      state.timeoutTime = timeout;
    },
    resetTimeoutTime: (state) => {
      state.timeoutTime = 300000; // Reset to default 5 minutes
    },
    setTimeoutInSeconds: (state, action) => {
      // Helper to set timeout in seconds instead of milliseconds
      const timeoutInMs = Math.min(
        Math.max(action.payload * 1000, 5000),
        900000
      );
      state.timeoutTime = timeoutInMs;
    },
  },
});

export const { setTimeoutTime, resetTimeoutTime, setTimeoutInSeconds } =
  timeoutSlice.actions;
export default timeoutSlice.reducer;
