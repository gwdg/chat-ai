export const checkVersionMiddleware =
  ({ getState, dispatch }) =>
  (next) =>
  (action) => {
    // Bypass the middleware for RESET_TEMPERATURE actions
    if (action.type !== "RESET_TEMPERATURE") {
      const currentStateVersion = getState().version;
      const localStorageVersion = localStorage.getItem("app_version");

      // If app version has changed
      if (currentStateVersion !== localStorageVersion) {
        // Executes the reset action
        dispatch({ type: "RESET_TEMPERATURE", payload: 0.5 });

        // Then, you update the version on local storage
        localStorage.setItem("app_version", currentStateVersion);
      }
    }

    return next(action);
  };
