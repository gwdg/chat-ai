import { useTranslation } from "react-i18next";
import UsageProgressBar from "./UsageProgressBar";

export default function OrgLimitsDisplay({ limits, variant = "profile" }) {
  const { t } = useTranslation();
  const orgLimits = limits?.org;
  if (!orgLimits) return null;
  if (
    (orgLimits?.monthly_usage !== null && orgLimits?.monthly_usage !== undefined)
  ) {
      // If user can see monthly usage and limits as org admin
      const monthlyUsageValue = Number(orgLimits.monthly_usage ?? 0);
      const monthlyUsage = Number.isFinite(monthlyUsageValue)
        ? monthlyUsageValue
        : 0;
      const monthlyLimit = orgLimits.monthly_limit;
      const monthlyLimitValue = Number(monthlyLimit);
      const hasLimit =
        monthlyLimit !== null &&
        monthlyLimit !== undefined &&
        Number.isFinite(monthlyLimitValue) &&
        monthlyLimitValue > 0;

      const usageFormatted = monthlyUsage.toFixed(2);
      const limitFormatted = hasLimit ? monthlyLimitValue.toFixed(variant == "sidebar" ? 0 : 2) : null;

      const progressPercent = hasLimit
        ? (monthlyUsage / monthlyLimitValue) * 100
        : null;
      const label = t("user_settings.org_usage");
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
  } else if (
    (orgLimits?.monthly_usage_percent !== null && orgLimits?.monthly_usage_percent !== undefined)
  ) {
    // Regular user, can only see percentage of monthly usage
    const monthlyPercent = Number(orgLimits.monthly_usage_percent) * 100;
    if (!Number.isFinite(monthlyPercent) || monthlyPercent < 0) return null;

    const label = t("user_settings.org_usage");

    return (
      <UsageProgressBar
        label={label}
        value={`${monthlyPercent.toFixed(2)}%`}
        percent={monthlyPercent}
        variant={variant}
        ariaLabel={label}
      />
    );
  }
  return null;
}
