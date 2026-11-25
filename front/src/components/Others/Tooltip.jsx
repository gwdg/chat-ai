import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

/**
 * A small hover label. With `interactive`, the trigger is also a click target:
 * a click pins the label (so its text can be read on a touch screen) and a
 * second click, a click outside or Escape closes it. Clicks never bubble, so a
 * badge inside a larger button cannot trigger that button.
 */
function Tooltip({
  text,
  children,
  placement = "top",
  offset = 8,
  className = "",
  interactive = false,
  width = "max-w-[200px]",
  align = "center",
}) {
  const ref = useRef(null);
  const bubbleRef = useRef(null);
  const [shift, setShift] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = Boolean(text) && (hovered || pinned);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();

      let top, left, transform;

      switch (placement) {
        case "bottom":
          top = r.bottom + offset;
          left = align === "end" ? r.right : r.left + r.width / 2;
          transform = align === "end" ? "translate(-100%, 0)" : "translate(-50%, 0)";
          break;
        case "left":
          top = r.top + r.height / 2;
          left = r.left - offset;
          transform = "translate(-100%, -50%)"; // shift left fully
          break;
        case "right":
          top = r.top + r.height / 2;
          left = r.right + offset;
          transform = "translate(0, -50%)"; // just shift vertically
          break;
        default: // top
          top = r.top - offset;
          left = r.left + r.width / 2;
          transform = "translate(-50%, -100%)"; // center horizontally, above
      }

      setPos({ top, left, transform });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, placement, offset, align]);

  // Keep the bubble inside the window instead of letting it run off the edge.
  useLayoutEffect(() => {
    if (!open || !pos || !bubbleRef.current) return;
    const rect = bubbleRef.current.getBoundingClientRect();
    const margin = 8;
    let next = 0;
    if (rect.right > window.innerWidth - margin) {
      next = window.innerWidth - margin - rect.right;
    }
    if (rect.left + next < margin) next = margin - rect.left;
    setShift(Math.round(next));
  }, [open, pos, text]);

  // A pinned label is dismissed by a click anywhere else or by Escape.
  useEffect(() => {
    if (!pinned) return;
    const close = (event) => {
      if (event.key !== undefined) {
        if (event.key === "Escape") setPinned(false);
        return;
      }
      if (!ref.current?.contains(event.target)) setPinned(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [pinned]);

  return (
    <>
      <span
        ref={ref}
        className={`${interactive ? "cursor-help" : "cursor-pointer"} ${className}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={
          interactive
            ? (event) => {
                event.stopPropagation();
                event.preventDefault();
                setPinned((value) => !value);
              }
            : undefined
        }
        aria-expanded={interactive ? open : undefined}
      >
        {children}
      </span>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={bubbleRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: `${pos.transform} translateX(${shift}px)`,
              zIndex: 9999
            }}
            className={`bg-neutral text-neutral-content text-xs leading-snug rounded px-2 py-1
                       border border-base-300 break-words shadow ${width}
                       ${interactive ? "whitespace-normal text-left" : "pointer-events-none"}`}
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
}

export default Tooltip;
