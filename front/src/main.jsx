import "regenerator-runtime/runtime"; // Import regenerator-runtime for async/await support
import "./i18n"; // Import internationalization setup
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { useEffect } from "react";

import store, { persistor } from "./Redux/store/store.jsx"; // Import Redux store and persistor
import App from "./App.jsx"; // Import main App component
import "./index.css"; // Import global CSS styles
import { setupTabChangeSync } from "./utils/tabChangeSync.js"; // Import tab change sync

// Simple wrapper component to set up tab sync
const TabSyncWrapper = ({ children }) => {
  useEffect(() => {
    // Set up tab-change-only synchronization
    const cleanup = setupTabChangeSync(store);

    // Clean up on unmount
    return cleanup;
  }, []);

  return children;
};

// Render the app inside the root element using createRoot for better performance
ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    {/* PersistGate ensures Redux store rehydration before rendering */}
    <PersistGate loading={null} persistor={persistor}>
      {/* TabSyncWrapper handles tab change synchronization */}
      <TabSyncWrapper>
        {/* Render the main App component */}
        <App />
      </TabSyncWrapper>
    </PersistGate>
  </Provider>
);
