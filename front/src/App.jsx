import { useSelector } from "react-redux";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import PublicRoute from "./Route/PublicRoute";
import { BrowserRouter } from "react-router";
import AgentConflictWatcher from "./components/Others/AgentConflictWatcher";
import SyncOnboardingWatcher from "./components/Others/SyncOnboardingWatcher";
import BrandConsentGate from "./components/Others/BrandConsentGate";
import { ToastProvider } from "./components/Others/ToastProvider";
import { ModalProvider } from "./modals/ModalContext";
import { FilePreviewProvider } from "./context/FilePreviewContext";
import { FeatureGuideProvider } from "./context/FeatureGuideContext";
import { requestPersistentStorage } from "./utils/storagePersistence";
import { useBrand } from "./config/BrandProvider";
import { activeBrandTheme, applyBrandDocument } from "./config/brands";
import { selectBrandTheme, selectDarkMode } from "./Redux/reducers/interfaceSettingsSlice";
import { TabTitleManager } from "./hooks/useTabTitle";
import { isSyncEnabled } from "./utils/modules";

function App() {
  const { i18n } = useTranslation();
  // `BrandProvider` lives in main.jsx, so reading the context here makes App
  // re-render when the brand resolves from `/user`. Feature and module accessors
  // read the brand from module state (see config/brandPolicy.js), and without
  // this subscription a claim-resolved brand's restrictions would only appear on
  // the next unrelated render.
  const { brand } = useBrand();

  const isDarkMode = useSelector(selectDarkMode);
  const themeId = useSelector(selectBrandTheme);
  // A custom brand theme may pin the colour scheme (business is dark-only, green
  // light-only) instead of following the light/dark preference.
  const brandTheme = activeBrandTheme(brand, themeId);
  const effectiveDark = brandTheme?.colorScheme
    ? brandTheme.colorScheme === "dark"
    : isDarkMode;

  // Both `<html>` and `<body>` carry the class: index.css keys its variables off
  // `.dark` and the brand palette is emitted for `:root.dark` and `body.dark`.
  // The brand document is (re)applied here because the active theme id is Redux
  // state, which BrandProvider does not read.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.toggle("dark", effectiveDark);
    if (body) {
      body.classList.toggle("dark", effectiveDark);
      body.classList.toggle("darkScrollbar", effectiveDark);
      body.classList.toggle("lightScrollbar", !effectiveDark);
    }
    applyBrandDocument(brand, themeId);
  }, [effectiveDark, brand, themeId]);

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
        <BrandConsentGate />
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
