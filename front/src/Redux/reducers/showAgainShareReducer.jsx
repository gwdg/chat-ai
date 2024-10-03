// Action Types
const SET_DONT_SHOW_AGAIN_SHARE = "SET_DONT_SHOW_AGAIN_SHARE";

// Action Creators
export const setDontShowAgainShare = (value) => ({
  type: SET_DONT_SHOW_AGAIN_SHARE,
  payload: value,
});

// Initial State
const initialState = {
  dontShowAgainShare: false,
};

// Reducer
const showAgainShareReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_DONT_SHOW_AGAIN_SHARE:
      return { ...state, dontShowAgainShare: action.payload };
    default:
      return state;
  }
};

export default showAgainShareReducer;
