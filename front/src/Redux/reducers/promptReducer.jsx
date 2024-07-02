// Reducer function for managing the state of the prompt
function promptReducer(state = "", action) {
  switch (action.type) {
    // Action type for setting the prompt
    case "SET_PROMPT":
      // Update the prompt state with the payload from the action
      return action.payload;
    default:
      // Return the current state if action type doesn't match
      return state;
  }
}

export default promptReducer;
