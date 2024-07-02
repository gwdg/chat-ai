// Reducer function for managing the state of responses
function alertReducer(state = 0, action) {
  switch (action.type) {
    // Action type for setting responses
    case "SET_COUNT":
      // Update the responses state with the payload from the action
      return action.payload;
    default:
      // Return the current state if action type doesn't match
      return state;
  }
}

export default alertReducer;
