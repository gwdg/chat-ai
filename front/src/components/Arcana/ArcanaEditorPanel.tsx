import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";

import ArcanaManager from "./ArcanaManager";
import { arcanaDisplayName } from "../../workspace/arcanas";
import type { RagCollection, RagFile } from "../../workspace/providers/saiaRag";

export const ARCANA_EDITOR_WIDTH_KEY = "chatai.arcana.editor-width";

const DEFAULT_WIDTH = 520;
const MIN_WIDTH = 320;
const MAX_WIDTH = 1024;

const clampWidth = (value: number) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));

const readWidth = () => {
  try {
    const value = Number(localStorage.getItem(ARCANA_EDITOR_WIDTH_KEY));
    return Number.isFinite(value) && value > 0
      ? clampWidth(value)
      : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
};

type ArcanaEditorPanelProps = {
  collection: RagCollection;
  initialTab?: "files" | "search" | "share";
  focus?: "upload";
  onFiles?: (files: RagFile[]) => void;
  onClose?: () => void;
};

/**
 * The collection editor, docked on the right of its page.
 *
 * The chat is the middle column (the usual chat shell), so files, tags, search
 * and sharing live in a panel beside it instead of splitting the page in half.
 * The width is remembered per browser and the divider can be dragged; on a
 * phone the panel takes the whole column, because a 320 px minimum does not fit
 * next to a chat.
 */
export default function ArcanaEditorPanel({
  collection,
  initialTab = "files",
  focus,
  onFiles,
  onClose,
}: ArcanaEditorPanelProps) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(readWidth);
  const widthRef = useRef(width);
  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const startResize = (event: ReactPointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    const onMove = (moveEvent: PointerEvent) => {
      setWidth(clampWidth(startWidth + startX - moveEvent.clientX));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(
          ARCANA_EDITOR_WIDTH_KEY,
          String(widthRef.current),
        );
      } catch {
        // A disabled store only costs the preference.
      }
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <aside
      className="relative flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm lg:w-[var(--arcana-editor-width)]"
      style={
        {
          "--arcana-editor-width": `${width}px`,
        } as CSSProperties
      }
      data-guide="arcana-editor"
      aria-label={t("arcanas.page_editor")}
    >
      <button
        type="button"
        onPointerDown={startResize}
        className="absolute inset-y-0 -left-1 z-20 hidden w-2 cursor-col-resize touch-none lg:block"
        title={t("arcanas.page_editor_resize")}
        aria-label={t("arcanas.page_editor_resize")}
      />
      <div className="flex shrink-0 items-center gap-1.5 border-b border-base-300 px-2 py-2">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-base-content">
          {t("arcanas.page_editor")}
          <span className="ml-1 font-normal text-base-content/60">
            · {arcanaDisplayName(collection)}
          </span>
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/45 hover:bg-base-200 hover:text-base-content"
            title={t("arcanas.page_editor_hide")}
            aria-label={t("arcanas.page_editor_hide")}
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 p-2">
        <ArcanaManager
          collection={collection}
          initialTab={initialTab}
          focus={focus}
          onFiles={onFiles}
          framed={false}
        />
      </div>
    </aside>
  );
}
