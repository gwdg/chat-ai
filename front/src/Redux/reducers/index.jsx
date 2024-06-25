import { combineReducers } from "redux";
import themeReducer from "./themeReducer";
import promptReducer from "./promptReducer";
import responsesReducer from "./responsesReducer";
import modelReducer from "./modelReducer";
import conReducer from "./conReducer";
import instructionsReducer from "./instructionsReducer";
import temperatureReducer from "./temperatureReducer";
import alertReducer from "./alertReducer";
import modelApiReducer from "./modelApiReducer";
import anncAlertReducer from "./anncAlertReducer";

// Combine all reducers into the root reducer
const rootReducer = combineReducers({
  theme: themeReducer,
  prompt: promptReducer,
  model: modelReducer,
  responses: responsesReducer,
  conversation: conReducer,
  instructions: instructionsReducer,
  temperature: temperatureReducer,
  count: alertReducer,
  anncCount: anncAlertReducer,
  modelApi: modelApiReducer,
});

export default rootReducer;
