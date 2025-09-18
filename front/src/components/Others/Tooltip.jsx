import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

function Tooltip({ text, children, placement = "top", offset = 8 }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
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
          left = r.left + r.width / 2;
          transform = "translate(-50%, 0)"; // center horizontally
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
  }, [open, placement, offset]);

  return (
    <>
      <span
        ref={ref}
        className="cursor-pointer"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </span>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: pos.transform,
              zIndex: 9999
            }}
            className="bg-gray-800 dark:bg-gray-700 text-white text-xs rounded px-2 py-1
                       border dark:border-border_dark max-w-[200px] break-words
                       pointer-events-none shadow"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
}

export default Tooltip;
