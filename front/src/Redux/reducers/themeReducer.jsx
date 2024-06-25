// Reducer function for managing the theme state
const initialTheme = { isDarkMode: false };

function themeReducer(state = initialTheme, action) {
  switch (action.type) {
    // Action type for toggling theme
    case "SET_THEME":
      // Toggle the isDarkMode value in the state
      return { ...state, isDarkMode: !state.isDarkMode };
    default:
      // Return the current state if action type doesn't match
      return state;
  }
}

export default themeReducer;
