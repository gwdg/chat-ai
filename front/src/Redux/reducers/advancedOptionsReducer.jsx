// Define device detection
const isMobileDevice = window.innerWidth <= 768;

// Initial state to be dependent on device type
const initialTheme = { isOpen: !isMobileDevice };

function advOptionReducer(state = initialTheme, action) {
  switch (action.type) {
    // Action type for toggling theme
    case "SET_ADV":
      // Toggle the isOpen value in the state
      return { ...state, isOpen: !state.isOpen };
    default:
      // Return the current state if action type doesn't match
      return state;
  }
}

export default advOptionReducer;
