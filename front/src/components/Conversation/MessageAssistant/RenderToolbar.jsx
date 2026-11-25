import { Code2, Download, Eye } from "lucide-react";

const BUTTON_CLASS =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-base-300 bg-base-100 px-2 py-1 text-[11px] font-medium text-base-content/70 shadow-sm transition-colors hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50";

export default function RenderToolbar({
  showCode,
  onToggle,
  renderLabel,
  showCodeLabel,
  onDownload,
  downloadLabel,
  toggleDisabled = false,
}) {
  if (!onDownload && !onToggle) return null;

  return (
    <div className="absolute -top-3 right-2 z-10 flex items-center gap-1">
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          aria-label={downloadLabel}
          title={downloadLabel}
          className={BUTTON_CLASS}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          disabled={toggleDisabled}
          aria-pressed={!showCode}
          className={BUTTON_CLASS}
        >
          {showCode ? (
            <>
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {renderLabel}
            </>
          ) : (
            <>
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              {showCodeLabel}
            </>
          )}
        </button>
      )}
    </div>
  );
}
