function clampPercent(percent) {
  const numericPercent = Number(percent);
  if (!Number.isFinite(numericPercent)) return null;
  return Math.min(Math.max(numericPercent, 0), 100);
}

function getProgressColor(percent) {
  if (percent >= 90) return "bg-red-500 dark:bg-red-500";
  if (percent >= 70) return "bg-yellow-400 dark:bg-yellow-400";
  return "bg-blue-500 dark:bg-blue-400";
}

export default function UsageProgressBar({
  label,
  value,
  percent,
  variant = "profile",
  ariaLabel,
}) {
  const clampedPercent = clampPercent(percent);
  const hasProgress = clampedPercent !== null;
  const progressColor = hasProgress ? getProgressColor(clampedPercent) : "";

  if (variant === "sidebar") {
    return (
      <div className="w-full min-w-0 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <span className="min-w-0 truncate text-[11px] font-medium text-gray-700 dark:text-gray-200">
            {label}
          </span>
          <span
            className="max-w-[62%] shrink-0 truncate text-right text-[11px] tabular-nums text-gray-500 dark:text-gray-300"
            title={typeof value === "string" ? value : undefined}
          >
            {value}
          </span>
        </div>
        {hasProgress && (
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
            role="progressbar"
            aria-label={ariaLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(clampedPercent)}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium text-gray-800 dark:text-gray-100">
          {label}
        </span>
        <span
          className="max-w-[58%] shrink-0 truncate text-right text-sm tabular-nums text-gray-600 dark:text-gray-300"
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </span>
      </div>

      {hasProgress && (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
          role="progressbar"
          aria-label={ariaLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clampedPercent)}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
