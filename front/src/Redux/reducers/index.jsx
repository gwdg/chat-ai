// index.jsx
import { combineReducers } from "redux";
import interfaceSettingsReducer from "./interfaceSettingsSlice";
import userSettingsReducer from "./userSettingsReducer";
import versionReducer from "./versionReducer";
import lastConversationSlice from "./lastConversationSlice";
import { migrationDataReducer } from "./migrationDataReducer";

// Root reducer
const rootReducer = combineReducers({
  interface_settings: interfaceSettingsReducer,
  user_settings: userSettingsReducer,
  last_conversation: lastConversationSlice,
  version: versionReducer,
  migration_data: migrationDataReducer,
});

export default rootReducer;
