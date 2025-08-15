// index.jsx
import { combineReducers } from "redux";
import interfaceSettingsReducer from "./interfaceSettingsSlice";
import userSettingsReducer from "./userSettingsReducer";
import currentConversationReducer from "./currentConversationSlice";
import versionReducer from "./versionReducer";


// Root reducer
const rootReducer = combineReducers({
  interface_settings: interfaceSettingsReducer,
  user_settings: userSettingsReducer,
  current_conversation: currentConversationReducer,
  version: versionReducer,
});

export default rootReducer;
