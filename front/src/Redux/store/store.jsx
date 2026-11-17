 
import { configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore, createMigrate } from "redux-persist";
import storage from "redux-persist/es/storage";
import rootReducer from "../reducers/index";
import {
  createStateSyncMiddleware,
  initMessageListener,
} from "redux-state-sync";
import { migrations } from "./migrations";
import { stateSyncConfig } from "./stateSync";

const persistConfig = {
  key: "root",
  storage,
  whitelist: [
    "interface_settings",
    "last_conversation",
    "user_settings",
    "migration_data",
  ],
  version: 10,
  migrate: createMigrate(migrations, { debug: true })
};

const getDefaultState = () => {
  return {
    last_conversation: null,
    interface_settings: {
      dark_mode: false,
      show_settings: false,
      show_sidebar: true,
      show_tour: true,
      warn_clear_history: true,
      warn_close_chat: true,
      warn_clear_memory: true,
      warn_clear_settings: true,
      warn_regenerate: true,
      warn_fork: true,
      warn_workspace_delete: true,
      warn_workspace_file_delete: true,
      warn_restore_agent_sessions: true,
      count_hallucination: 0,
      count_announcement: 0,
      show_usage_in_sidebar: true,
      collapsed_topics: [],
      expanded_agents: [],
      conversation_sort: "created_desc",
      conversation_grouping: "topic",
      completed_tutorials: [],
      completed_use_cases: [],
      suppressed_tutorials: [],
    },
    // Conditionally preserve memories
    user_settings: {
      memories: [],
      memory_groups: [],
      default_memory_group: "default",
      mcp_servers: [],
      timeout: 300000,
      memory_mode: 0,
      suggest_user_prompts: false,
      html_render_mode: "off",
      html_load_external: false,
      html_sanitization: "strict",
      set_title_once: true,
      render_typst: false,
      render_latex: false,
      render_graphviz: false,
      render_vega: false,
      render_chartjs: false,
      collapse_reasoning_while_streaming: true,
      document_conversion_mode: "choice",
      conversation_summaries: true,
      show_timestamps: false,
      advanced_mode: false,
      send_with_enter: null,
      e2ee_keys: [],
      e2ee_models: {},
    },
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

// Configuration for redux-state-sync lives in ./stateSync.js: every `user_settings` action syncs,
// because redux-persist rewrites the whole persisted state from each tab (see that file).

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
});

export default store;
