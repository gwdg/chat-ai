// Action Types
const IMAGE_EXPORT_SETTINGS = "IMAGE_EXPORT_SETTINGS";

// Action Creators
export const setExportImage = (value) => ({
  type: IMAGE_EXPORT_SETTINGS,
  payload: value,
});

// Initial State
const initialState = {
  exportImage: false,
};

// Reducer
const imageIncludeReducer = (state = initialState, action) => {
  switch (action.type) {
    case IMAGE_EXPORT_SETTINGS:
      return { ...state, exportImage: action.payload };
    default:
      return state;
  }
};

export default imageIncludeReducer;
