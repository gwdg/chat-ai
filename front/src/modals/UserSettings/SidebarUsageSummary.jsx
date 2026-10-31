import { useTranslation } from "react-i18next";
import UsageDetailsCard from "./UsageDetailsCard";

const SCOPES = [
  { key: "external", labelKey: "user_settings.usage.scopes.external" },
  { key: "internal", labelKey: "user_settings.usage.scopes.internal" },
];

function hasValue(value) {
  return value !== null && value !== undefined;
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatAmount(value) {
  const number = toFiniteNumber(value) ?? 0;
  return number.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatCount(value) {
  const number = toFiniteNumber(value) ?? 0;
  return number.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatResetTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function buildCurrencyMetric(key, label, usage, limit) {
  const usageValue = toFiniteNumber(usage) ?? 0;
  const limitValue = toFiniteNumber(limit);
  const hasLimit = hasValue(limit) && limitValue !== null && limitValue > 0;

  return {
    key,
    label,
    value: hasLimit
      ? `${formatAmount(usageValue)} / ${formatAmount(limitValue)}€`
      : `${formatAmount(usageValue)}€`,
    percent: hasLimit ? (usageValue / limitValue) * 100 : null,
  };
}

function buildPercentMetric(key, label, rawPercent) {
  if (!hasValue(rawPercent)) return null;

  const percent = Number(rawPercent) * 100;
  if (!Number.isFinite(percent) || percent < 0) return null;

  return {
    key,
    label,
    value: `${percent.toFixed(2)}%`,
    percent,
  };
}

function buildLimitMetrics(entry, prefix, t) {
  if (!entry) return [];

  const metrics = [];
  const hasMonthlyUsage =
    hasValue(entry.monthly_usage) || hasValue(entry.monthly_limit);

  if (hasMonthlyUsage) {
    metrics.push(
      buildCurrencyMetric(
        `${prefix}_monthly`,
        t("user_settings.usage.monthly"),
        entry.monthly_usage,
        entry.monthly_limit,
      ),
    );
  } else if (hasValue(entry.monthly_usage_percent)) {
    const monthly = buildPercentMetric(
      `${prefix}_monthly`,
      t("user_settings.usage.monthly"),
      entry.monthly_usage_percent,
    );
    if (monthly) metrics.push(monthly);
  }

  if (hasValue(entry.total_usage_percent)) {
    const total = buildPercentMetric(
      `${prefix}_total`,
      t("user_settings.usage.total"),
      entry.total_usage_percent,
    );
    if (total) metrics.push(total);
  } else if (hasValue(entry.total_usage) || hasValue(entry.total_limit)) {
    metrics.push(
      buildCurrencyMetric(
        `${prefix}_total`,
        t("user_settings.usage.total"),
        entry.total_usage,
        entry.total_limit,
      ),
    );
  }

  return metrics;
}

function buildRateMetrics(entries, prefix, t) {
  const metrics = [];

  Object.entries(entries ?? {}).forEach(([window, data]) => {
    const limit = toFiniteNumber(data?.limit);
    if (limit === null || limit <= 0) return;

    const used = toFiniteNumber(data?.used) ?? 0;
    const resetTime = data?.resets_at
      ? formatResetTime(data.resets_at)
      : null;

    metrics.push({
      key: `${prefix}_${window}`,
      label: t(`user_settings.usage.rate_limits.${window}`, {
        defaultValue: window,
      }),
      value: `${formatCount(used)} / ${formatCount(limit)}`,
      percent: (used / limit) * 100,
      inlineDetail: resetTime
        ? t("user_settings.usage.resets_at", { time: resetTime })
        : null,
    });
  });

  return metrics;
}

function getLimitEntryLabel(entryKey, t) {
  if (entryKey === "user") return t("user_settings.usage.personal");
  if (entryKey === "org") return t("user_settings.usage.organization");
  return entryKey.charAt(0).toUpperCase() + entryKey.slice(1);
}

function buildScope(scopeKey, scopeLabel, scopeData, t) {
  const sections = [];

  Object.entries(scopeData?.limits ?? {}).forEach(([entryKey, entry]) => {
    const metrics = buildLimitMetrics(
      entry,
      `${scopeKey}_${entryKey}`,
      t,
    );
    if (!metrics.length) return;

    sections.push({
      key: `${scopeKey}_limits_${entryKey}`,
      groupKey: scopeKey,
      groupLabel: scopeLabel,
      title: getLimitEntryLabel(entryKey, t),
      metrics,
    });
  });

  const requests = buildRateMetrics(
    scopeData?.rate_limits?.requests,
    `${scopeKey}_requests`,
    t,
  );
  if (requests.length) {
    sections.push({
      key: `${scopeKey}_requests`,
      groupKey: scopeKey,
      groupLabel: scopeLabel,
      title: t("user_settings.usage.sections.requests"),
      metrics: requests,
    });
  }

  const rateBudget = buildRateMetrics(
    scopeData?.rate_limits?.budget,
    `${scopeKey}_rate_budget`,
    t,
  );
  if (rateBudget.length) {
    sections.push({
      key: `${scopeKey}_rate_budget`,
      groupKey: scopeKey,
      groupLabel: scopeLabel,
      title: t("user_settings.usage.sections.budget"),
      metrics: rateBudget,
    });
  }

  if (!sections.length) return null;

  const allMetrics = sections.flatMap((section) => section.metrics);
  const personalMonthly = allMetrics.find((metric) =>
    metric.key.endsWith("_user_monthly"),
  );
  const organizationMonthly = allMetrics.find((metric) =>
    metric.key.endsWith("_org_monthly"),
  );
  const primary = personalMonthly ?? organizationMonthly ?? allMetrics[0];

  return {
    sections,
    compact: {
      ...primary,
      key: `${scopeKey}_compact`,
      label: scopeLabel,
    },
  };
}

export default function SidebarUsageSummary({ data }) {
  const { t } = useTranslation();
  const sections = [];
  const collapsedMetrics = [];

  SCOPES.forEach(({ key, labelKey }) => {
    const scope = buildScope(key, t(labelKey), data?.[key], t);
    if (!scope) return;

    sections.push(...scope.sections);
    collapsedMetrics.push(scope.compact);
  });

  if (!sections.length) return null;

  return (
    <UsageDetailsCard
      label={t("user_settings.usage.title")}
      sections={sections}
      collapsedMetrics={collapsedMetrics}
      collapsedColumns
      expandedTable
    />
  );
}
