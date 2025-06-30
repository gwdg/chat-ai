// index.jsx
import { combineReducers } from "redux";
import themeReducer from "./themeReducer";
import alertReducer from "./alertReducer";
import anncAlertReducer from "./anncAlertReducer";
import advOptionReducer from "./advancedOptionsReducer";
import conversationsReducer from "./conversationsSlice";
import defaultModelReducer from "./defaultModelSlice";
import versionReducer from "./versionReducer";
import userMemoryReducer from "./userMemorySlice";
import timeoutReducer from "./timeoutReducer";

// Root reducer
const rootReducer = combineReducers({
  theme: themeReducer,
  count: alertReducer,
  anncCount: anncAlertReducer,
  conversations: conversationsReducer,
  advOptions: advOptionReducer,
  defaultModel: defaultModelReducer,
  version: versionReducer,
  userMemory: userMemoryReducer,
  timeout: timeoutReducer,
});

export default rootReducer;
