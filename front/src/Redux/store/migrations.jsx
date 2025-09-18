import { getDefaultSettings } from "../../utils/conversationUtils";

import { interfaceSettingsInitialState } from "../reducers/interfaceSettingsSlice";
import { userSettingsInitialState } from "../reducers/userSettingsReducer";

// Migration functions for different versions
export const migrations = {
  // Version 1
  1: (state) => {
    // Check old version format
    if (state.version == 1) { 
      // Migrate from version v1 to v2
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
    } 
    if (state.version == 2) {
      // Migrate from version v2 to v3
      state.version = 3;
      // Only minor non-breakable changes introduced in v3
    }
    // Migrate from version old v3 to new v1
    state.migration_data = {
      ...state,
    };
    state.interface_settings = {}; // set from defualt value?
    state.interface_settings.show_tour = true;
    state.user_settings = {};
    if (state?.theme?.isDarkMode) state.interface_settings.dark_mode = true;
    if (state?.advOptions?.isOpen) state.interface_settings.show_settings = true;
    state.user_settings.memories = state?.userMemory?.memories || [];
    state.user_settings.timeout = state?.timeout?.timeoutTime || 300000;
    if (state?.defaultModel) {
      state.user_settings.model = state?.defaultModel;
    }
    delete state.theme;
    delete state.conversations;
    delete state.advOptions;
    delete state.defaultModel;
    delete state.userMemory;
    delete state.timeout;
    console.log("Requires safe migration of conversation");
    
    return state;
  },
  2: (state) => {
    // if the persist version is lower than 4 then this migration will be executed
    // this has nothing to do with the state.version!!
    
    console.log("Redux: Migrating to version 2 from ", state.version);

    // Populate missing settings with initial state values
    return {
      ...state,
      version: 2,
      interface_settings: {
        ...interfaceSettingsInitialState,
        ...state.interface_settings,
      },
      user_settings: {
        ...userSettingsInitialState,
        ...state.user_settings,
      },
    };

  },  
  // Future migrations here (e.g., 2: (state) => {...})
};