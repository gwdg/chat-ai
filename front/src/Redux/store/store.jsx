import { configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import storage from "redux-persist/lib/storage";
import rootReducer from "../reducers/index";
import {
  createStateSyncMiddleware,
  initMessageListener,
} from "redux-state-sync";
import { v4 as uuidv4 } from "uuid";

const persistConfig = {
  key: "root",
  storage,
};

// Create a custom reducer that handles the RESET_ALL action
const rootReducerWithReset = (state, action) => {
  if (action.type === "RESET_ALL") {
    // Extract the newConversationId and preserved states
    const { newConversationId, theme, advOption } = action.payload || {};

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
        model: "Meta Llama 3.1 8B Instruct",
        model_api: "meta-llama-3.1-8b-instruct",
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
        key: "",
      },
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    // Reset the entire state but preserve the specified states
    return {
      ...rootReducer(undefined, { type: "@@INIT" }),
      conversations: {
        conversations: [newConversation],
        currentConversationId: newConversation.id,
        isResponding: false,
      },
      // Preserve specified states
      theme: theme || state.theme,
      advOption: advOption || state.advOption,
    };
  }

  return rootReducer(state, action);
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
    "theme/setDarkMode",
    "theme/setLightMode",
    "theme/toggleTheme",
    "SET_ADV",
    "RESET_ALL",
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
export const persistor = persistStore(store);

export default store;
