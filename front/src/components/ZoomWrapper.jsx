import { useEffect } from "react";

function ZoomWrapper({ children }) {
  useEffect(() => {
    const initialValue = document.body.style.zoom;

    // Change zoom level on mount
    document.body.style.zoom = "90%";

    return () => {
      // Restore default value on unmount
      document.body.style.zoom = initialValue;
    };
  }, []);

  return <>{children}</>;
}

export default ZoomWrapper;
