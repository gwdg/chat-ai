// Action Types
const EXPORT_SETTINGS = "EXPORT_SETTINGS";

// Action Creators
export const setExportSettings = (value) => ({
  type: EXPORT_SETTINGS,
  payload: value,
});

// Initial State
const initialState = {
  exportSettings: false,
};

// Reducer
const fileIncludeSettings = (state = initialState, action) => {
  switch (action.type) {
    case EXPORT_SETTINGS:
      return { ...state, exportSettings: action.payload };
    default:
      return state;
  }
};

export default fileIncludeSettings;
