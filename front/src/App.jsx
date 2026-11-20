import { useSelector } from "react-redux";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import PublicRoute from "./Route/PublicRoute";
import { BrowserRouter } from "react-router";
import AgentConflictWatcher from "./components/Others/AgentConflictWatcher";
import { ToastProvider } from "./components/Others/ToastProvider";
import { ModalProvider } from "./modals/ModalContext";
import { FilePreviewProvider } from "./context/FilePreviewContext";
import { FeatureGuideProvider } from "./context/FeatureGuideContext";
import { requestPersistentStorage } from "./utils/storagePersistence";
import { BrandProvider } from "./config/BrandProvider";
import { TabTitleManager } from "./hooks/useTabTitle";

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
      <BrandProvider>
        <TabTitleManager />
        <ToastProvider/>
        <AgentConflictWatcher />
        <ModalProvider>
          <FilePreviewProvider>
            <FeatureGuideProvider>
              <PublicRoute />
            </FeatureGuideProvider>
          </FilePreviewProvider>
        </ModalProvider>
      </BrandProvider>
    </BrowserRouter>
  );
}

export default App;
