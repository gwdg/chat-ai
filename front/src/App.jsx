import { useSelector } from "react-redux";
import { useEffect } from "react";

import PublicRoute from "./Route/PublicRoute";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "./components/Others/ToastProvider";

function App() {
  const isDarkMode = useSelector((state) => state.theme.isDarkMode);

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
    <BrowserRouter>
      <ToastProvider>
        <PublicRoute />{" "}
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
