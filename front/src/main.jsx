import "regenerator-runtime/runtime"; // Import regenerator-runtime for async/await support
import "./i18n"; // Import internationalization setup
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

import store, { persistor } from "./Redux/store/store.jsx"; // Import Redux store and persistor
import App from "./App.jsx"; // Import main App component
import "./index.css"; // Import global CSS styles

// Render the app inside the root element using createRoot for better performance
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Provide the Redux store to the entire app */}
    <Provider store={store}>
      {/* PersistGate ensures Redux store rehydration before rendering */}
      <PersistGate loading={null} persistor={persistor}>
        {/* Render the main App component */}
        <App />
      </PersistGate>
    </Provider>
  </React.StrictMode>
);
