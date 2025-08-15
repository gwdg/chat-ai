// Migration functions for different versions
const migrations = {
  1: (state) => {
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

    return state;
  },
  2: (state) => {
    // Migrate from version v2 to v3
    state.version = 3;
    // Only minor non-breakable changes introduced in v3
    // Nothing to do here
    return state;
  },
  3: (state) => {
    // Migrate from version v3 to v4
    state.version = 4;

    // Major restructuring, plenty to do
    state.conversations = state.conversations.conversations
    return state;
  },
  // Future migrations here (e.g., 4: (state) => {...})
};

// Function to apply migrations
export const applyMigrations = (state) => {
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