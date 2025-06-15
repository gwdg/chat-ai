/* eslint-disable no-unused-vars */
import { configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import storage from "redux-persist/lib/storage";
import rootReducer from "../reducers/index";
import {
  createStateSyncMiddleware,
  initMessageListener,
} from "redux-state-sync";
import { v4 as uuidv4 } from "uuid";
import { getDefaultSettings } from "../../utils/settingsUtils";

const persistConfig = {
  key: "root",
  storage,
  whitelist: [
    "theme",
    "conversations",
    "advOptions",
    "defaultModel",
    "version",
    "userMemory",
    "timeout",
  ],
};

// Helper function to get default model from settings
const getDefaultModelFromSettings = () => {
  const defaultSettings = getDefaultSettings();
  return {
    name: defaultSettings["model-name"],
    id: defaultSettings.model,
  };
};

// Helper function to create a new conversation with proper defaults
const createNewConversation = (conversationId, defaultModel) => {
  const defaultSettings = getDefaultSettings();
  const settings = {
    ...defaultSettings,
    // Override with provided default model if available
    ...(defaultModel && {
      ["model-name"]: defaultModel.name,
      model: defaultModel.id,
    }),
  };

  return {
    id: conversationId || uuidv4(),
    title: "Untitled Conversation",
    conversation: [
      {
        role: "system",
        content: settings.systemPrompt,
      },
    ],
    responses: [],
    prompt: "",
    settings,
    exportOptions: {
      exportSettings: false,
      exportImage: false,
      exportArcana: false,
    },
    dontShow: {
      dontShowAgain: false,
      dontShowAgainShare: false,
      dontShowAgainMemory: false,
    },
    arcana: {
      id: "",
    },
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
};

// Migration functions for different versions
const migrations = {
  1: (state) => {
    // Migrate from version 1 to 2
    state.version = 2;

    // Get default settings for migration
    const defaultSettings = getDefaultSettings();

    // Migrate all conversations
    state.conversations = {
      ...state.conversations,
      conversations: state.conversations.conversations.map((conv) => {
        const newSettings = { ...conv.settings };

        // Convert old version to new
        if (newSettings.model_api !== undefined) {
          newSettings["model-name"] = newSettings.model;
          newSettings.model = newSettings.model_api;
          delete newSettings.model_api;
        }

        // Ensure all settings have proper defaults
        const migratedSettings = {
          ...defaultSettings,
          ...newSettings,
        };

        return {
          ...conv,
          settings: migratedSettings,
        };
      }),
    };

    return state;
  },
  // Future migrations here (e.g., 2: (state) => {...})
};

// Function to apply migrations
const applyMigrations = (state) => {
  const latestVersion = Object.keys(migrations).length + 1;
  console.log("Loaded Chat AI state version:", state.version);
  state.version = state.version || 1;

  // If the version is outdated, apply migrations
  while (state.version < latestVersion) {
    if (migrations[state.version]) {
      try {
        console.log("Migrating from", state.version, " to ", state.version + 1);
        state = migrations[state.version](state);
      } catch (error) {
        console.error(`Migration from version ${state.version} failed:`, error);
        break; // Stop migration on error
      }
    } else {
      console.log("No migrations left");
      break;
    }
  }

  return { ...state, version: state.version };
};

// Create a custom reducer that handles the RESET_ALL action
const rootReducerWithReset = (state, action) => {
  let newState;
  if (action.type === "RESET_ALL") {
    // Extract the newConversationId and preserved states
    const {
      newConversationId,
      theme,
      advOption,
      defaultModel,
      preserveMemories,
    } = action.payload || {};

    // Use the provided default model, or get from current state, or use fallback from settings
    const currentDefaultModel =
      defaultModel || state?.defaultModel || getDefaultModelFromSettings();

    // Create a new conversation with proper defaults
    const newConversation = createNewConversation(
      newConversationId,
      currentDefaultModel
    );

    // Reset the entire state but preserve the specified states
    newState = {
      ...rootReducer(undefined, { type: "@@INIT" }),
      version: 2,
      conversations: {
        conversations: [newConversation],
        currentConversationId: newConversation.id,
        isResponding: false,
      },
      // Preserve specified states
      theme: theme || state?.theme || { isDarkMode: false },
      advOption: advOption || state.advOption,
      defaultModel: currentDefaultModel,
      // Conditionally preserve memories
      userMemory: preserveMemories
        ? state?.userMemory || {
            memories: [],
            nextId: 1,
          }
        : {
            memories: [],
            nextId: 1,
          },
    };
  } else if (action.type === "MIGRATE") {
    // Apply migrations to the new state
    newState = applyMigrations(rootReducer(state, action));
  } else {
    newState = rootReducer(state, action);
  }
  return newState;
};

// Custom middleware to prevent certain actions from syncing
const preventSyncMiddleware = (store) => (next) => (action) => {
  // Don't sync navigation-related actions - each tab should handle its own navigation
  if (
    action.type === "conversations/setCurrentConversation" &&
    action.meta?.skipSync
  ) {
    // This is a local navigation action, don't sync it
    return next({
      ...action,
      meta: { ...action.meta, skipBroadcast: true },
    });
  }

  return next(action);
};

const persistedRootReducer = persistReducer(
  persistConfig,
  rootReducerWithReset
);

// Configuration for redux-state-sync - REMOVED setCurrentConversation from whitelist
const stateSyncConfig = {
  // Whitelist the actions that should sync across tabs
  whitelist: [
    "conversations/addConversation",
    "conversations/updateConversation",
    "conversations/deleteConversation",
    "conversations/resetStore",
    "conversations/setIsResponding",
    "defaultModel/setDefaultModel",
    "defaultModel/resetDefaultModel",
    "theme/toggleTheme",
    "theme/setDarkMode",
    "theme/setLightMode",
    "userMemory/addMemory",
    "userMemory/editMemory",
    "userMemory/deleteMemory",
    "userMemory/deleteAllMemories",
    "timeout/setTimeoutTime",
    "timeout/resetTimeoutTime",
    "timeout/setTimeoutInSeconds",
    "SET_ADV",
    "RESET_ALL",
    "MIGRATE",
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
      .concat(preventSyncMiddleware)
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
