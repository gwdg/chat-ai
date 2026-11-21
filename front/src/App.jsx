import { useSelector } from "react-redux";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import PublicRoute from "./Route/PublicRoute";
import { BrowserRouter } from "react-router";
import AgentConflictWatcher from "./components/Others/AgentConflictWatcher";
import SyncOnboardingWatcher from "./components/Others/SyncOnboardingWatcher";
import { ToastProvider } from "./components/Others/ToastProvider";
import { ModalProvider } from "./modals/ModalContext";
import { FilePreviewProvider } from "./context/FilePreviewContext";
import { FeatureGuideProvider } from "./context/FeatureGuideContext";
import { requestPersistentStorage } from "./utils/storagePersistence";
import { useBrand } from "./config/BrandProvider";
import { TabTitleManager } from "./hooks/useTabTitle";
import { isSyncEnabled } from "./utils/modules";

function App() {
  const { i18n } = useTranslation();
  // `BrandProvider` lives in main.jsx, so reading the context here makes App
  // re-render when the brand resolves from `/user`. Feature and module accessors
  // read the brand from module state (see config/brandPolicy.js), and without
  // this subscription a claim-resolved brand's restrictions would only appear on
  // the next unrelated render.
  useBrand();

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
      <TabTitleManager />
      <ToastProvider/>
      <AgentConflictWatcher />
      <ModalProvider>
        {isSyncEnabled() && <SyncOnboardingWatcher />}
        <FilePreviewProvider>
          <FeatureGuideProvider>
            <PublicRoute />
          </FeatureGuideProvider>
        </FilePreviewProvider>
      </ModalProvider>
    </BrowserRouter>
  );
}

export default App;
