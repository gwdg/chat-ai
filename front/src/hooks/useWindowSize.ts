import { useEffect, useState } from "react";

export function useWindowSize() {

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Responsive breakpoints - aligned with Tailwind config
  // https://tailwindcss.com/docs/responsive-design
  const isMobile = windowWidth < 640;
  const isTablet = windowWidth < 1280;
  const isDesktop = windowWidth >= 1280;
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      setWindowWidth(newWidth);
    };

    handleResize(); // Call on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(window.matchMedia("(pointer: coarse)").matches);
    };

    checkTouch();
    window.addEventListener("resize", checkTouch);

    return () => {
      window.removeEventListener("resize", checkTouch);
    };
  }, []);

  return { isMobile, isTablet, isDesktop, isTouch };
}
