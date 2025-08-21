import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

function Tooltip({ text, children }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.top - 8, left: r.left + r.width / 2 }); // 8px gap above
    };
    update();
    // capture scroll on any ancestor + window resize
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

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
              transform: "translate(-50%, -100%)",
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
