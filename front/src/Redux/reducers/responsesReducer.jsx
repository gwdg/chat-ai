// Reducer function for managing the state of responses
function responsesReducer(state = [], action) {
  switch (action.type) {
    // Action type for setting responses
    case "SET_RESPONSES":
      // Update the responses state with the payload from the action
      return action.payload;
    default:
      // Return the current state if action type doesn't match
      return state;
  }
}

export default responsesReducer;
