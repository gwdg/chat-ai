// Root Reducer for combining all slices
import { combineReducers } from "redux";
import themeReducer from "./themeReducer";
import alertReducer from "./alertReducer";
import anncAlertReducer from "./anncAlertReducer";
import advOptionReducer from "./advancedOptionsReducer";
import conversationsReducer from "./conversationsSlice";

const appReducer = combineReducers({
  theme: themeReducer,
  count: alertReducer,
  anncCount: anncAlertReducer,
  conversations: conversationsReducer,
  advOptions: advOptionReducer,

});

const rootReducer = (state, action) => {
  if (action.type === "RESET_ALL") {
    // Reset state of all reducers except theme
    const { theme } = state;
    state = { theme };
  }
  return appReducer(state, action);
};

export default rootReducer;
