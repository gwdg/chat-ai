import { useSelector } from "react-redux";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import PublicRoute from "./Route/PublicRoute";
import { BrowserRouter } from "react-router";
import { ToastProvider } from "./components/Others/ToastProvider";
import { ModalProvider } from "./modals/ModalContext";

function App() {
  const { i18n } = useTranslation();

  const isDarkMode = useSelector((state) => state.interface_settings.dark_mode);

  // Add or remove the 'dark' class to the body based on the dark mode state
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Render the PublicRoute component
  return (
    <BrowserRouter key={i18n.language}>
      <ToastProvider/>
      <ModalProvider>
        <PublicRoute />
      </ModalProvider>
    </BrowserRouter>
  );
}

export default App;
