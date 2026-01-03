import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipPosition = "right" | "top" | "left";

interface ShortcutTooltipProps {
  children: ReactNode;
  label: string;
  shortcut?: string;
  position?: TooltipPosition;
  enterDelay?: number;
}

export default function ShortcutTooltip({
  children,
  label,
  shortcut,
  position = "right",
  enterDelay = 0,
}: ShortcutTooltipProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ left: 0, top: 0 });
  const [isClient, setIsClient] = useState(false);
  const delayRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsClient(true);
    }
  }, []);

  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (position === "right") {
      setCoords({ left: rect.right + 12, top: rect.top + rect.height / 2 });
    } else if (position === "left") {
      setCoords({ left: rect.left - 12, top: rect.top + rect.height / 2 });
    } else {
      setCoords({ left: rect.left + rect.width / 2, top: rect.top - 8 });
    }
  }, [position]);

  useEffect(() => {
    if (!visible || !isClient) return;
    updatePosition();
    const handle = () => updatePosition();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [visible, isClient, updatePosition]);

  const tooltip =
    isClient && visible
      ? createPortal(
          <div
            className={`pointer-events-none fixed z-50 whitespace-nowrap rounded-2xl bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg dark:bg-white dark:text-gray-900 ${
              position === "right"
                ? "-translate-y-1/2"
                : position === "left"
                  ? "-translate-x-full -translate-y-1/2"
                  : "-translate-x-1/2 -translate-y-full"
            }`}
            style={{ left: coords.left, top: coords.top }}
          >
            <span>{label}</span>
            {shortcut ? (
              <span className="ml-2 text-gray-300 dark:text-gray-500">
                {shortcut}
              </span>
            ) : null}
          </div>,
          document.body
        )
      : null;

  const showTooltip = () => {
    if (enterDelay > 0) {
      delayRef.current = window.setTimeout(() => {
        setVisible(true);
        delayRef.current = null;
      }, enterDelay);
    } else {
      setVisible(true);
    }
  };

  const hideTooltip = () => {
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    setVisible(false);
  };

  useEffect(() => () => {
    if (delayRef.current) {
      clearTimeout(delayRef.current);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {tooltip}
    </div>
  );
}
