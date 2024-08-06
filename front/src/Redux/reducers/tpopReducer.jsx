// Reducer function for managing the state of temperature
function tpopReducer(state = 0.5, action) {
  switch (action.type) {
    // Action type for setting temperature
    case "SET_TPOP":
      // Update the temperature state with the payload from the action
      return action.payload;
    default:
      // Return the current state if action type doesn't match
      return state;
  }
}

export default tpopReducer;
