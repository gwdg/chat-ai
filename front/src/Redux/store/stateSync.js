// Cross-tab sync policy.
//
// redux-persist writes the whole persisted state on every action, in every tab. A tab that did not
// receive a global change therefore keeps its own stale copy and writes it back over localStorage,
// so a change made in another tab (for example a newly added MCP server) disappears on the next
// reload. `user_settings` holds account-level data - MCP servers, memories, memory groups, E2EE
// keys - so every mutation of it has to reach the other tabs.
const GLOBAL_ACTIONS = ["SET_ADV", "RESET_ALL", "MIGRATE", "SET_COUNT"];

export const isStateSyncAction = (action) =>
  typeof action?.type === "string" &&
  (GLOBAL_ACTIONS.includes(action.type) ||
    action.type.startsWith("user_settings/"));

export const stateSyncConfig = {
  predicate: isStateSyncAction,
  // Use localStorage for better compatibility
  broadcastChannelOption: {
    type: "localstorage",
  },
};
