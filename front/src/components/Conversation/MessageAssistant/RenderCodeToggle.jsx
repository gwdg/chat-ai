import { Code2, Eye } from "lucide-react";

export default function RenderCodeToggle({
  showCode,
  onToggle,
  renderLabel,
  showCodeLabel,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={!showCode}
      className="absolute -top-3 right-2 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-base-300 bg-base-100 px-2 py-1 text-[11px] font-medium text-base-content/70 shadow-sm transition-colors hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
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
  );
}
