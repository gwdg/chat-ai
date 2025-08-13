import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { useCallback, useRef } from "react";

export const useToast = () => {
  const isDarkMode = useSelector((state) => state.interface_settings.dark_mode);
  const toastClass = isDarkMode ? "dark-toast" : "light-toast";
  const toastIdRef = useRef(null);

  const notifySuccess = useCallback(
    (message) => {
      // If there's an active toast, don't create a new one
      if (toast.isActive(toastIdRef.current)) {
        return;
      }

      // Dismiss all existing toasts
      toast.dismiss();

      // Generate a unique ID for this toast
      const newToastId = `success-${Date.now()}`;
      toastIdRef.current = newToastId;

      toast.success(message, {
        className: toastClass,
        toastId: newToastId,
        autoClose: 1000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        onClose: () => {
          toastIdRef.current = null;
        },
      });
    },
    [isDarkMode]
  );

  const notifyError = useCallback(
    (message) => {
      // If there's an active toast, don't create a new one
      if (toast.isActive(toastIdRef.current)) {
        return;
      }

      // Dismiss all existing toasts
      toast.dismiss();

      // Generate a unique ID for this toast
      const newToastId = `error-${Date.now()}`;
      toastIdRef.current = newToastId;

      toast.error(message, {
        className: toastClass,
        toastId: newToastId,
        autoClose: 1000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        onClose: () => {
          toastIdRef.current = null;
        },
      });
    },
    [isDarkMode]
  );

  return { notifySuccess, notifyError };
};
