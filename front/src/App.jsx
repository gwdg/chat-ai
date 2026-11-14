import { useSelector } from "react-redux";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import PublicRoute from "./Route/PublicRoute";
import { BrowserRouter } from "react-router";
import { ToastProvider } from "./components/Others/ToastProvider";
import { ModalProvider } from "./modals/ModalContext";
import { FeatureGuideProvider } from "./context/FeatureGuideContext";
import { requestPersistentStorage } from "./utils/storagePersistence";

function App() {
  const { i18n } = useTranslation();

  const isDarkMode = useSelector((state) => state.interface_settings.dark_mode);

  // Add or remove the 'dark' class to the body based on the dark mode state
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove("lightScrollbar");
      document.body.classList.add("dark", "darkScrollbar");

    } else {
      document.body.classList.remove("dark", "darkScrollbar");
      document.body.classList.add("lightScrollbar");
    }
  }, [isDarkMode]);

  useEffect(() => {
    void requestPersistentStorage();
    const request = () => {
      void requestPersistentStorage();
    };
    window.addEventListener("pointerdown", request, { once: true });
    window.addEventListener("keydown", request, { once: true });
    return () => {
      window.removeEventListener("pointerdown", request);
      window.removeEventListener("keydown", request);
    };
  }, []);

  // Render the PublicRoute component
  return (
    <BrowserRouter key={i18n.language}>
      <ToastProvider/>
      <ModalProvider>
        <FeatureGuideProvider>
          <PublicRoute />
        </FeatureGuideProvider>
      </ModalProvider>
    </BrowserRouter>
  );
}

export default App;
