// Action Types
const SET_DONT_SHOW_AGAIN = "SET_DONT_SHOW_AGAIN";

// Action Creators
export const setDontShowAgain = (value) => ({
  type: SET_DONT_SHOW_AGAIN,
  payload: value,
});

// Initial State
const initialState = {
  dontShowAgain: false,
};

// Reducer
const showAgainReducer = (state = initialState, action) => {
  switch (action.type) {
    case SET_DONT_SHOW_AGAIN:
      return { ...state, dontShowAgain: action.payload };
    default:
      return state;
  }
};

export default showAgainReducer;
