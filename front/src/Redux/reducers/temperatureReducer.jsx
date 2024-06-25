// Reducer function for managing the state of temperature
function temperatureReducer(state = 1, action) {
  switch (action.type) {
    // Action type for setting temperature
    case "SET_TEMPERATURE":
      // Update the temperature state with the payload from the action
      return action.payload;
    default:
      // Return the current state if action type doesn't match
      return state;
  }
}

export default temperatureReducer;
