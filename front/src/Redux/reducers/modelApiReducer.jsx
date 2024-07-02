// Reducer function for managing the state of the model
function modelApiReducer(state = "meta-llama-3-8b-instruct", action) {
  switch (action.type) {
    // Action type for setting the model
    case "SET_MODEL_API":
      // Update the model state with the payload from the action
      return action.payload;
    default:
      // Return the current state if action type doesn't match
      return state;
  }
}

export default modelApiReducer;
