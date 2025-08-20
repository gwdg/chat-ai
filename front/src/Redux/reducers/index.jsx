// index.jsx
import { combineReducers } from "redux";
import interfaceSettingsReducer from "./interfaceSettingsSlice";
import userSettingsReducer from "./userSettingsReducer";
import currentConversationReducer from "./currentConversationSlice";
import versionReducer from "./versionReducer";

import {appApi } from "./appApi"

// Root reducer
const rootReducer = combineReducers({
  interface_settings: interfaceSettingsReducer,
  user_settings: userSettingsReducer,
  current_conversation: currentConversationReducer,
  version: versionReducer,

  // Mount RTK Query's reducer
  [appApi.reducerPath]: appApi.reducer,
});

export default rootReducer;
