import { useCallback, useState } from "react";
import { ZoomIn, ZoomOut } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.25;

const clampZoom = (value) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));

/**
 * Zoom state for one preview. The caller scales its own content, because a PDF
 * lives in an iframe and a rendered Typst document in a shadow root: only the
 * factor is shared. The state belongs to the mounted preview, so opening another
 * file starts at 100 % again.
 */
export function useZoom() {
  const [zoom, setZoom] = useState(1);
  const zoomIn = useCallback(
    () => setZoom((value) => clampZoom(value + ZOOM_STEP)),
    [],
  );
  const zoomOut = useCallback(
    () => setZoom((value) => clampZoom(value - ZOOM_STEP)),
    [],
  );
  const reset = useCallback(() => setZoom(1), []);
  return { zoom, zoomIn, zoomOut, reset };
}

/**
 * - / 125 % / +, shared by the PDF preview and a rendered Typst document. The
 * percentage is the reset control: it names the current factor and returns to
 * 100 % in one click.
 */
export default function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  className = "",
}) {
  const { t } = useTranslation();
  const percent = `${Math.round(zoom * 100)}%`;

  return (
    <div className={`join ${className}`.trim()} data-guide="preview-zoom">
      <button
        type="button"
        className="btn btn-ghost btn-xs join-item"
        data-guide="preview-zoom-out"
        title={t("file_preview.zoom_out")}
        aria-label={t("file_preview.zoom_out")}
        onClick={onZoomOut}
        disabled={zoom <= MIN_ZOOM}
      >
        <ZoomOut size={14} />
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs join-item tabular-nums"
        data-guide="preview-zoom-reset"
        title={t("file_preview.zoom_reset")}
        aria-label={t("file_preview.zoom_reset")}
        onClick={onReset}
        disabled={zoom === 1}
      >
        {percent}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs join-item"
        data-guide="preview-zoom-in"
        title={t("file_preview.zoom_in")}
        aria-label={t("file_preview.zoom_in")}
        onClick={onZoomIn}
        disabled={zoom >= MAX_ZOOM}
      >
        <ZoomIn size={14} />
      </button>
    </div>
  );
}
