import { useRef } from "react";
import { ArrowLeft, Close, Document } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

const WIDTH_KEY = "documentPanelWidth";
const KEYBOARD_STEP = 32;

function readStoredWidth() {
  try {
    return localStorage.getItem(WIDTH_KEY);
  } catch {
    return null;
  }
}

function storeWidth(value) {
  try {
    localStorage.setItem(WIDTH_KEY, value);
  } catch {
    // Per-viewer convenience only; ignore blocked storage.
  }
}

export default function PanelShell({ title, subtitle, actions, onClose, children }) {
  const { t } = useTranslation();
  const panelRef = useRef(null);

  const setWidth = (px) => {
    const value = `${Math.round(px)}px`;
    panelRef.current?.style.setProperty("--doc-w", value);
    return value;
  };

  const handlePointerDown = (event) => {
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const right = container.getBoundingClientRect().right;
    panel.dataset.resizing = "true";
    let last = null;
    const move = (moveEvent) => {
      last = setWidth(right - moveEvent.clientX);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      delete panel.dataset.resizing;
      if (last) storeWidth(`${Math.round(panel.getBoundingClientRect().width)}px`);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  const handleKeyDown = (event) => {
    const panel = panelRef.current;
    if (!panel || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const current = panel.getBoundingClientRect().width;
    setWidth(current + (event.key === "ArrowLeft" ? KEYBOARD_STEP : -KEYBOARD_STEP));
    storeWidth(`${Math.round(panel.getBoundingClientRect().width)}px`);
  };

  const storedWidth = readStoredWidth();

  return (
    <aside
      ref={panelRef}
      aria-label={title}
      style={storedWidth ? { "--doc-w": storedWidth } : undefined}
      className="group/doc fixed inset-0 z-50 flex min-h-0 flex-col bg-base-100 md:relative md:inset-auto md:z-auto md:w-[clamp(18rem,var(--doc-w,45%),calc(100%-20rem))] md:shrink-0 md:border-l md:border-base-300 data-[resizing]:select-none"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("document_panel.resize")}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        className="absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize touch-none md:block after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-primary after:opacity-0 after:transition-opacity hover:after:opacity-60 focus-visible:outline-none focus-visible:after:opacity-100 group-data-[resizing]/doc:after:opacity-100"
      />

      <header className="flex items-center gap-2 border-b border-base-300 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] md:pt-2.5">
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square md:hidden"
          onClick={onClose}
          aria-label={t("document_panel.back_to_chat")}
          title={t("document_panel.back_to_chat")}
        >
          <ArrowLeft size={20} />
        </button>
        <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-base-200 text-accent md:flex">
          <Document size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {subtitle && <p className="truncate text-[11px] text-base-content/50">{subtitle}</p>}
        </div>
        {actions}
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square hidden md:inline-flex"
          onClick={onClose}
          aria-label={t("common.close")}
          title={t("common.close")}
        >
          <Close size={18} />
        </button>
      </header>

      {children}
    </aside>
  );
}
