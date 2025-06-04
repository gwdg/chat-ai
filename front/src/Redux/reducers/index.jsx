// index.jsx
import { combineReducers } from "redux";
import themeReducer from "./themeReducer";
import alertReducer from "./alertReducer";
import anncAlertReducer from "./anncAlertReducer";
import advOptionReducer from "./advancedOptionsReducer";
import conversationsReducer from "./conversationsSlice";
import defaultModelReducer from "./defaultModelSlice";

// Version reducer to track the global data version
const versionReducer = (state = 1, action) => {
  return state;
};

// Root reducer
const rootReducer = combineReducers({
  theme: themeReducer,
  count: alertReducer,
  anncCount: anncAlertReducer,
  conversations: conversationsReducer,
  advOptions: advOptionReducer,
  defaultModel: defaultModelReducer,
  version: versionReducer,
});

export default rootReducer;
