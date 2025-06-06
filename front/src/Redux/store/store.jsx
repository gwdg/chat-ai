import { configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import storage from "redux-persist/lib/storage";
import rootReducer from "../reducers/index";
import {
  createStateSyncMiddleware,
  initMessageListener,
  isActionSynced,
} from "redux-state-sync";
import { v4 as uuidv4 } from "uuid";

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["theme", "conversations", "advOptions", "defaultModel", "version", ],
};

// Migration functions for different versions
const migrations = {
  1: (state) => {
    // Migrate from version 1 to 2
    state.version = 2;
  
    // Migrate all conversations
    state.conversations = {
      ...state.conversations,
      conversations: state.conversations.conversations.map((conv) => {
        const newSettings = { ...conv.settings};
        // Convert old version to new
        if (newSettings.model_api !== undefined) {
          newSettings["model-name"] = newSettings.model;
          newSettings.model = newSettings.model_api;
          delete newSettings.model_api;
        }
        return {
          ...conv,
          settings: newSettings,
        }
      }),
    }

    return state;
  },
  // Future migrations here (e.g., 2: (state) => {...})
};

// Function to apply migrations
const applyMigrations = (state) => {
  const latestVersion = Object.keys(migrations).length + 1;
  state.version = state.version || 1;

  // If the version is outdated, apply migrations
  while (state.version < latestVersion) {
    if (migrations[state.version]) {
      try {
        state = migrations[state.version](state);
      } catch (error) {
        console.error(`Migration from version ${state.version} failed:`, error);
        break; // Stop migration on error
      }
    } else {
      break;
    }
  }

  return { ...state, version: state.version }
};

// Create a custom reducer that handles the RESET_ALL action
const rootReducerWithReset = (state, action) => {
  let newState;
  if (action.type === "RESET_ALL") {
    // Extract the newConversationId and preserved states
    const { newConversationId, theme, advOption, defaultModel } =
      action.payload || {};

    // Use the provided default model, or get from current state, or use fallback
    const currentDefaultModel = defaultModel ||
      state?.defaultModel || {
        name: "Meta Llama 3.1 8B Instruct",
        id: "meta-llama-3.1-8b-instruct",
      };

    // Create a new conversation with the provided ID or generate a new one
    const newConversation = {
      id: newConversationId || uuidv4(),
      title: "Untitled Conversation",
      conversation: [
        {
          role: "system",
          content: "You are a helpful assistant",
        },
      ],
      responses: [],
      prompt: "",
      settings: {
        ["model-name"]: currentDefaultModel.name,
        model: currentDefaultModel.id,
        temperature: 0.5,
        top_p: 0.5,
        systemPrompt: "You are a helpful assistant",
      },
      exportOptions: {
        exportSettings: false,
        exportImage: false,
        exportArcana: false,
      },
      dontShow: {
        dontShowAgain: false,
        dontShowAgainShare: false,
      },
      arcana: {
        id: "",
      },
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

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
    };
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

// Configuration for redux-state-sync
const stateSyncConfig = {
  // Whitelist the actions that should sync across tabs
  whitelist: [
    "conversations/addConversation",
    "conversations/updateConversation",
    "conversations/deleteConversation",
    "conversations/setCurrentConversation",
    "conversations/resetStore",
    "conversations/setIsResponding",
    "defaultModel/setDefaultModel", // Added default model actions
    "defaultModel/resetDefaultModel",
    "theme/toggleTheme",
    "theme/setDarkMode",
    "theme/setLightMode",
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
    }).concat(createStateSyncMiddleware(stateSyncConfig)),
});

// Initialize the message listener to respond to changes from other tabs
initMessageListener(store);

// Create the persistor object to persist the Redux store
export const persistor = persistStore(store, null, () => {
  // this will be invoked after rehydration is complete
  store.dispatch({ type: "MIGRATE" });
});
export default store;
