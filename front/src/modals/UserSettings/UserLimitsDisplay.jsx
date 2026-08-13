import { useTranslation } from "react-i18next";
import UsageProgressBar from "./UsageProgressBar";

export default function UserLimitsDisplay({ limits, variant = "profile" }) {
  const { t } = useTranslation();
  const userLimits = limits?.user;
  if (!userLimits) return null;

  const monthlyUsageValue = Number(userLimits.monthly_usage ?? 0);
  const monthlyUsage = Number.isFinite(monthlyUsageValue)
    ? monthlyUsageValue
    : 0;
  const monthlyLimit = userLimits.monthly_limit;
  const monthlyLimitValue = Number(monthlyLimit);
  const hasLimit =
    monthlyLimit !== null &&
    monthlyLimit !== undefined &&
    Number.isFinite(monthlyLimitValue) &&
    monthlyLimitValue > 0;

  const usageFormatted = monthlyUsage.toFixed(2);
  const limitFormatted = hasLimit ? monthlyLimitValue.toFixed(2) : null;

  const progressPercent = hasLimit
    ? (monthlyUsage / monthlyLimitValue) * 100
    : null;
  const label = t("user_settings.monthly_usage");
  const value = hasLimit
    ? `€${usageFormatted} / €${limitFormatted}`
    : `€${usageFormatted}`;

  return (
    <UsageProgressBar
      label={label}
      value={value}
      percent={progressPercent}
      variant={variant}
      ariaLabel={label}
    />
  );
}
