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
import arcanaReducer from "./arcanaReducer";
import advOptionReducer from "./advancedOptionsReducer";
import selectedArcanaReducer from "./arcanaSelectReducer";
import tpopReducer from "./tpopReducer";
import showAgainReducer from "./showAgainReducer";
import fileIncludeSettings from "./fileIncludeSettings";
import showAgainShareReducer from "./showAgainShareReducer";

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
  arcana: arcanaReducer,
  advOptions: advOptionReducer,
  selectedArcana: selectedArcanaReducer,
  top_p: tpopReducer,
  showAgain: showAgainReducer,
  showAgainShare: showAgainShareReducer,
  exportSettings: fileIncludeSettings,
});

export default rootReducer;
