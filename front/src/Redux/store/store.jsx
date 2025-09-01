/* eslint-disable no-unused-vars */
import { configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import storage from "redux-persist/lib/storage";
import rootReducer from "../reducers/index";
import {
  createStateSyncMiddleware,
  initMessageListener,
} from "redux-state-sync";
import { applyMigrations } from "./migrations";

const persistConfig = {
  key: "root",
  storage,
  whitelist: [
    "interface_settings",
    "last_conversation",
    "user_settings",
    "version",
  ],
};

const getDefaultState = () => {
  return {
    version: 4,
    last_conversation: null,
    interface_settings: {
      dark_mode: false,
      show_settings: false,
      show_sidebar: true,
      warn_clear_history: true,
      warn_clear_memory: true,
      warn_clear_settings: true,
      count_hallucination: 0,
      count_announcement: 0,
    },
    // Conditionally preserve memories
    user_settings: {
      memories: [],
      timeout: 300000,
    },
  };
};

// Create a custom reducer that handles the RESET_ALL action
const rootReducerWithReset = (state, action) => {
  let newState;
  if (action.type === "RESET_ALL") {
    // Reset the entire state
    newState = getDefaultState();
  } else if (action.type === "MIGRATE") {
    // Apply migrations to the new state
    newState = applyMigrations(rootReducer(state, action));
  } else {
    newState = rootReducer(state, action);
  }
  return newState;
};

const persistedRootReducer = persistReducer(
  persistConfig,
  rootReducerWithReset
);

// Configuration for redux-state-sync - REMOVED setCurrentConversation from whitelist
const stateSyncConfig = {
  // Whitelist the actions that should sync across tabs
  whitelist: [
    // "conversations/addConversation",
    // "conversations/updateConversation",
    // "conversations/deleteConversation",
    // "conversations/resetStore",
    // "conversations/setIsResponding",
    // "defaultModel/setDefaultModel",
    // "defaultModel/resetDefaultModel",
    // "theme/toggleTheme",
    // "theme/setDarkMode",
    // "theme/setLightMode",
    // "userMemory/addMemory",
    // "userMemory/editMemory",
    // "userMemory/deleteMemory",
    // "userMemory/deleteAllMemories",
    // "timeout/setTimeoutTime",
    // "timeout/resetTimeoutTime",
    // "timeout/setTimeoutInSeconds",
    "SET_ADV",
    "RESET_ALL",
    "MIGRATE",
    "SET_COUNT",
  ],
  // Use localStorage for better compatibility
  broadcastChannelOption: {
    type: "localstorage",
  },
};

// Create the Redux store with the persisted reducer and middleware
export const store = configureStore({
  reducer: persistedRootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Ignore checking non-serializable values
    })
      .concat(createStateSyncMiddleware(stateSyncConfig)),
});

// Initialize the message listener to respond to changes from other tabs
initMessageListener(store);

// Create the persistor object to persist the Redux store
export const persistor = persistStore(store, null, () => {
  // this will be invoked after rehydration is complete
  store.dispatch({ type: "MIGRATE" });
});

export default store;
