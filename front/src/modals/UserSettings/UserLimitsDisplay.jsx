import { Trans } from "react-i18next";

export default function UserLimitsDisplay({ limits }) {
  const userLimits = limits?.user;
  if (!userLimits) return null;

  const monthlyUsage = userLimits.monthly_usage ?? 0;
  const monthlyLimit = userLimits.monthly_limit;

  const usageFormatted = monthlyUsage.toFixed(2);
  const limitFormatted = monthlyLimit !== null ? monthlyLimit.toFixed(2) : null;

  const progressPercent =
    monthlyLimit !== null && monthlyLimit > 0
      ? Math.min((monthlyUsage / monthlyLimit) * 100, 100)
      : null;

  const getProgressColor = (percent) => {
    if (percent >= 90) return "bg-red-500 dark:bg-red-500";
    if (percent >= 70) return "bg-yellow-400 dark:bg-yellow-400";
    return "bg-blue-500 dark:bg-blue-400";
  };

  return (
    <div className="w-full flex flex-row items-center gap-3">
      {/* Label */}
      <span className="font-medium text-sm dark:text-white whitespace-nowrap flex-shrink-0">
        <Trans i18nKey="user_settings.monthly_usage" />
      </span>

      {progressPercent !== null ? (
        <>
          {/* Progress bar */}
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(progressPercent)}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Usage / Limit */}
          <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap flex-shrink-0 tabular-nums">
            €{usageFormatted}
            <span className="text-gray-400 dark:text-gray-500"> / €{limitFormatted}</span>
          </span>
        </>
      ) : (
        <span className="text-sm text-gray-600 dark:text-gray-300 tabular-nums flex-shrink-0">
          €{usageFormatted}
        </span>
      )}
    </div>
  );
}