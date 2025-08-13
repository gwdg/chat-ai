// index.jsx
import { combineReducers } from "redux";
import interfaceSettingsReducer from "./interfaceSettingsSlice";
import userSettingsReducer from "./userSettingsReducer";
import conversationsReducer from "./conversationsSlice";
import currentConversationReducer from "./currentConversationSlice";
import versionReducer from "./versionReducer";


// Root reducer
const rootReducer = combineReducers({
  interface_settings: interfaceSettingsReducer,
  user_settings: userSettingsReducer,
  conversations: conversationsReducer,
  current_conversation: currentConversationReducer,
  version: versionReducer,
});

export default rootReducer;
