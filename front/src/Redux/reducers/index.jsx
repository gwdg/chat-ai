// index.jsx - Updated
import { combineReducers } from "redux";
import themeReducer from "./themeReducer";
import alertReducer from "./alertReducer";
import anncAlertReducer from "./anncAlertReducer";
import advOptionReducer from "./advancedOptionsReducer";
import conversationsReducer from "./conversationsSlice";
import defaultModelReducer from "./defaultModelSlice";

const rootReducer = combineReducers({
  theme: themeReducer,
  count: alertReducer,
  anncCount: anncAlertReducer,
  conversations: conversationsReducer,
  advOptions: advOptionReducer,
  defaultModel: defaultModelReducer,
});

export default rootReducer;
