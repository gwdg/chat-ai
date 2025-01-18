import { useEffect } from "react";

function ZoomWrapper({ children }) {
  useEffect(() => {
    // Store the initial zoom value for restoration
    const initialValue = document.body.style.zoom;

    // Set document zoom to 90% on component mount
    document.body.style.zoom = "90%";

    // Cleanup function to restore original zoom level when component unmounts
    return () => {
      document.body.style.zoom = initialValue;
    };
  }, []);

  // Render children without additional wrapping elements
  return <>{children}</>;
}

export default ZoomWrapper;
