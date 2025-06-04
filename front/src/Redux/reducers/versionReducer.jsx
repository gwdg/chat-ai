// Version reducer to track the global data version
function versionReducer (state = 1, action) {
  if (action.type === "SET_VERSION") {
    return action.payload
  }
  return state;
};

export default versionReducer;