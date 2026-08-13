import { useTranslation } from "react-i18next";
import UsageProgressBar from "./UsageProgressBar";

export default function OrgLimitsDisplay({ limits, variant = "profile" }) {
  const { t } = useTranslation();
  const orgLimits = limits?.org;
  if (!orgLimits) return null;
  if (
    orgLimits.monthly_usage_percent === null ||
    orgLimits.monthly_usage_percent === undefined
  ) {
    return null;
  }

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
