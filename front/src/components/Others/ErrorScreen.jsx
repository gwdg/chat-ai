import { AlertTriangle, RotateCw } from "lucide-react";

export default function ErrorScreen({
  title,
  message,
  details,
  reloadLabel,
  onReload,
}) {
  return (
    <div className="grid min-h-dvh place-items-center bg-base-200 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-base-300 bg-base-100 p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-warning" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-base-content">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-base-content/80">
              {message}
            </p>
          </div>
        </div>
        {details ? (
          <details className="mt-4 text-xs text-base-content/70">
            <summary className="cursor-pointer select-none">Details</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-base-200 p-3">
              {details}
            </pre>
          </details>
        ) : null}
        <button
          type="button"
          onClick={onReload ?? (() => window.location.reload())}
          className="btn btn-accent mt-5 w-full sm:w-auto"
        >
          <RotateCw className="h-4 w-4" />
          {reloadLabel}
        </button>
      </div>
    </div>
  );
}
