import { getDefaultSettings } from "../../utils/conversationUtils";

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
    state.interface_settings = {};
    state.interface_settings.show_tour = true;
  },
  3: (state) => {
    state.interface_settings.show_tour = true;
    state.interface_settings.collapsed_topics = [];
    console.log("Migrating redux to v3")
  },
  4: (state) => {
    state.user_settings = {
      ...state.user_settings,
      browser_document_conversion:
        state.user_settings?.browser_document_conversion ?? true,
    };
    console.log("Migrating redux to v4");
  },
  5: (state) => {
    const settings = state.user_settings ?? {};
    settings.document_conversion_mode =
      settings.document_conversion_mode ??
      (settings.browser_document_conversion === false ? "server" : "choice");
    delete settings.browser_document_conversion;
    state.user_settings = settings;
    console.log("Migrating redux to v5");
  },
  6: (state) => {
    state.interface_settings = state.interface_settings ?? {};
    state.interface_settings.conversation_sort =
      state.interface_settings.conversation_sort ?? "created_desc";
    console.log("Migrating redux to v6");
  },
  7: (state) => {
    state.user_settings = state.user_settings ?? {};
    state.user_settings.conversation_summaries =
      state.user_settings.conversation_summaries ?? true;
    console.log("Migrating redux to v7");
  },
  8: (state) => {
    state.user_settings = state.user_settings ?? {};
    state.user_settings.memory_groups = Array.isArray(
      state.user_settings.memory_groups,
    )
      ? state.user_settings.memory_groups
      : [];
    state.user_settings.default_memory_group =
      typeof state.user_settings.default_memory_group === "string"
        ? state.user_settings.default_memory_group
        : "default";
    state.user_settings.memories = (
      state.user_settings.memories ?? []
    ).map((memory) => ({
      ...memory,
      groupId: memory?.groupId ?? "default",
    }));
    console.log("Migrating redux to v8");
  },
  // Future migrations here (e.g., 9: (state) => {...})
};
