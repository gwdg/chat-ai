export const SET_INSTRUCTIONS = "SET_INSTRUCTIONS";

// Reducer function for managing the state of instructions
function instructionsReducer(state = "You are a helpful assistant", action) {
  switch (action.type) {
    case SET_INSTRUCTIONS:
      return action.payload;
    default:
      return state;
  }
}

export default instructionsReducer;
