import { TriangleAlert } from "lucide-react";

export default function MiniToolButton({ active, disabled, onClick, Icon, label, title, guideKey, warning = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-guide={`tool-${guideKey}`}
      className={[
        "group w-full select-none",
        "rounded-xl border text-sm font-medium",
        "px-3 py-2 md:px-3.5 md:py-2.5",
        "flex flex-col items-center justify-center gap-2",
        "transition-all",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : active
          ? "border-success bg-success/10 text-success cursor-pointer"
          : "border-base-300 bg-base-100 text-base-content hover:bg-base-200 cursor-pointer",
        active ? "shadow-sm" : "shadow-none",
      ].join(" ")}
      title={title || label}
    >
      <Icon className="h-6 w-6 md:h-7 md:w-7 shrink-0" aria-hidden="true" />
      <span className="flex items-center justify-center gap-1 leading-none text-xs text-center">
        {warning && (
          <TriangleAlert className="h-3 w-3 shrink-0 text-warning" aria-hidden="true" />
        )}
        {label}
      </span>
    </button>
  );
}
