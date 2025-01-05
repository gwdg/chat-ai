// Reducer function for managing the state of the model
function modelReducer(state = "Meta Llama 3.1 8B Instruct", action) {
  switch (action.type) {
    // Action type for setting the model
    case "SET_MODEL":
      // Update the model state with the payload from the action
      return action.payload;
    default:
      // Return the current state if action type doesn't match
      return state;
  }
}

export default modelReducer;
