import { Trans } from "react-i18next";

export default function OrgLimitsDisplay({ limits }) {
  const orgLimits = limits?.org;
  if (!orgLimits) return null;
  if (!orgLimits?.monthly_usage_percent) return null;
  let monthlyPercent = 100*orgLimits.monthly_usage_percent ?? 0;
  if (isNaN(monthlyPercent)) return null;
  const percentFormatted = monthlyPercent.toFixed(2);
  monthlyPercent =
    monthlyPercent >= 0
      ? Math.min(monthlyPercent, 100)
      : null;

  const getProgressColor = (percent) => {
    if (percent >= 90) return "bg-red-500 dark:bg-red-500";
    if (percent >= 70) return "bg-yellow-400 dark:bg-yellow-400";
    return "bg-blue-500 dark:bg-blue-400";
  };

  return monthlyPercent !== null && (
    <div className="w-full flex flex-row items-center gap-3">
      {/* Label */}
      <span className="font-medium text-sm dark:text-white whitespace-nowrap flex-shrink-0">
        <Trans i18nKey="user_settings.org_usage" />
      </span>
      {/* Progress bar */}
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getProgressColor(monthlyPercent)}`}
          style={{ width: `${monthlyPercent}%` }}
        />
      </div>
      {/* Percent */}
      <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap flex-shrink-0 tabular-nums">
        {percentFormatted}%
      </span>
    </div>
  );
}