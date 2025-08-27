import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useSelector } from "react-redux";
import { memo } from "react";

export const ToastProvider = memo(({ children }) => {
  const isDarkMode = useSelector((state) => state.interface_settings.dark_mode);

  return (
      <ToastContainer
        position="top-right"
        autoClose={1000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss={false} // Changed to false to prevent pause issues
        draggable
        pauseOnHover
        theme={isDarkMode ? "dark" : "light"}
        limit={1}
        enableMultiContainer={false}
      />
  );
});

ToastProvider.displayName = "ToastProvider";
