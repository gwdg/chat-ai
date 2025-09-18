/* eslint-disable no-unused-vars */
import { configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore, createMigrate } from "redux-persist";
import storage from "redux-persist/lib/storage";
import rootReducer from "../reducers/index";
import {
  createStateSyncMiddleware,
  initMessageListener,
} from "redux-state-sync";
import { migrations } from "./migrations";

import { interfaceSettingsInitialState } from "../reducers/interfaceSettingsSlice";
import { userSettingsInitialState } from "../reducers/userSettingsReducer";

const persistConfig = {
  key: "root",
  storage,
  whitelist: [
    "interface_settings",
    "last_conversation",
    "user_settings",
    "version",
    "migration_data",
  ],
  version: 2, // this is the redux persist target version
  migrate: createMigrate(migrations, { debug: true })
};

const getDefaultState = () => {
  return {
    version: persistConfig.version,
    last_conversation: null,
    interface_settings: interfaceSettingsInitialState,
    // Conditionally preserve memories
    user_settings: userSettingsInitialState,
  };
};

// Create a custom reducer that handles the RESET_ALL action
const rootReducerWithReset = (state, action) => {
  let newState;
  if (action.type === "RESET_ALL") {
    // Reset the entire state
    newState = getDefaultState();
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
  //store.dispatch({ type: "MIGRATE" });
});

export default store;
