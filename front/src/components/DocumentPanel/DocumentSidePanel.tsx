import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Close, Document, Download } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import { useFile } from "../../db";
import FilePreview, { DocxViewer } from "./FilePreview";

const WIDTH_KEY = "documentPanelWidth";
const KEYBOARD_STEP = 32;

function formatBytes(bytes?: number): string {
  if (typeof bytes !== "number") return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readStoredWidth(): string | null {
  try {
    return localStorage.getItem(WIDTH_KEY);
  } catch {
    return null;
  }
}

function storeWidth(value: string) {
  try {
    localStorage.setItem(WIDTH_KEY, value);
  } catch {
    // Per-viewer convenience only; ignore blocked storage.
  }
}

/**
 * Canvas-style document viewer. Docked beside the chat from `md` up (width is
 * a CSS variable clamped in CSS, adjusted by dragging the left edge); below
 * `md` it is a full-page overlay with a back arrow instead of a close button.
 */
function PanelShell({
  title,
  subtitle,
  actions,
  onClose,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLElement | null>(null);

  const setWidth = (px: number) => {
    const value = `${Math.round(px)}px`;
    panelRef.current?.style.setProperty("--doc-w", value);
    return value;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const right = container.getBoundingClientRect().right;
    panel.dataset.resizing = "true";
    let last: string | null = null;
    const move = (moveEvent: PointerEvent) => {
      last = setWidth(right - moveEvent.clientX);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      delete panel.dataset.resizing;
      // Store the width the CSS clamp actually produced.
      if (last) storeWidth(`${Math.round(panel.getBoundingClientRect().width)}px`);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
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
      style={storedWidth ? ({ "--doc-w": storedWidth } as React.CSSProperties) : undefined}
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

/** A stored file (attachment or agent output). */
export default function DocumentSidePanel({
  fileId,
  onClose,
}: {
  fileId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { file, data } = useFile(fileId) as { file: any; data: ArrayBuffer | null };

  const handleDownload = () => {
    if (!file || !data) return;
    const objectUrl = URL.createObjectURL(new File([data], file.name || "download", { type: file.type }));
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = file.name || "download";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  return (
    <PanelShell
      title={file?.name ?? ""}
      subtitle={file ? `${file.type}${file.size ? ` · ${formatBytes(file.size)}` : ""}` : undefined}
      onClose={onClose}
      actions={
        data && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={handleDownload}
            aria-label={t("file_preview.save")}
            title={t("file_preview.save")}
          >
            <Download size={18} />
          </button>
        )
      }
    >
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <FilePreview fileId={fileId} />
      </div>
    </PanelShell>
  );
}

export type DocumentDraft = {
  callId: string;
  path?: string;
  text: string;
  /** Streamed Markdown that will become a .docx (create_docx). */
  docx?: boolean;
};

/**
 * A document the agent is still writing, shown from the streamed tool-call
 * arguments. Replaced by the stored file once the tool has run.
 */
export function DraftDocumentPanel({ draft, onClose }: { draft: DocumentDraft; onClose: () => void }) {
  const { t } = useTranslation();
  const title = draft.path?.split("/").pop() || t("document_panel.untitled");
  return (
    <PanelShell
      title={title}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <span className="loading loading-dots loading-xs text-primary" />
          {t("document_panel.writing")}
        </span>
      }
      onClose={onClose}
    >
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {draft.docx ? (
          <LiveDocxPreview markdown={draft.text} />
        ) : (
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-base-200 p-6 font-mono text-sm text-base-content">
            {draft.text}
          </pre>
        )}
      </div>
    </PanelShell>
  );
}

const LIVE_DOCX_INTERVAL_MS = 400;

/**
 * Converts the streamed Markdown with the same converter create_docx uses and
 * renders it as Word pages. At most one conversion runs at a time, and only
 * the newest text is converted next.
 */
function LiveDocxPreview({ markdown }: { markdown: string }) {
  const [data, setData] = useState<Uint8Array | null>(null);
  const latest = useRef(markdown);
  const busy = useRef(false);
  const alive = useRef(true);
  latest.current = markdown;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Each chunk only starts the loop when it is idle; a running loop picks up
  // the newest text itself, so chunks never cancel a conversion in flight.
  useEffect(() => {
    if (busy.current) return;
    busy.current = true;
    (async () => {
      const { markdownToDocx } = await import("../../agent/docx");
      let done: string | null = null;
      while (alive.current && latest.current !== done) {
        done = latest.current;
        try {
          const bytes = await markdownToDocx(done);
          if (alive.current) setData(bytes);
        } catch {
          // Partial Markdown can fail to convert; the next chunk usually fixes it.
        }
        await new Promise((resolve) => setTimeout(resolve, LIVE_DOCX_INTERVAL_MS));
      }
      busy.current = false;
    })();
  }, [markdown]);

  if (!data) return <pre className="whitespace-pre-wrap break-words rounded-lg bg-base-200 p-6 font-mono text-sm text-base-content">{markdown}</pre>;
  return <DocxViewer data={data} />;
}
