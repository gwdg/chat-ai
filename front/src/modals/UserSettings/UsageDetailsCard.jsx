import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Tooltip from "../../components/Others/Tooltip";

const NEAR_EXHAUSTED_PERCENT = 80;

function clampPercent(percent) {
  const numericPercent = Number(percent);
  if (!Number.isFinite(numericPercent)) return null;
  return Math.min(Math.max(numericPercent, 0), 100);
}

function getProgressColor(percent) {
  if (percent >= 90) return "bg-error";
  if (percent >= 70) return "bg-warning";
  return "bg-info";
}

function UsageMetricRow({
  label,
  value,
  percent,
  detail,
  inlineDetail,
  showDetail,
  compact,
}) {
  const clampedPercent = clampPercent(percent);

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 min-w-0">
        {showDetail && inlineDetail ? (
          <Tooltip text={inlineDetail} className="block min-w-0 flex-1">
            <span className="block min-w-0 truncate text-[11px] font-medium text-base-content">
              {label}
            </span>
          </Tooltip>
        ) : (
          <Tooltip text={label} className="block min-w-0 flex-1">
            <span className="block min-w-0 truncate text-[11px] font-medium text-base-content">
              {label}
            </span>
          </Tooltip>
        )}
        <Tooltip
          text={typeof value === "string" ? value : String(value ?? "")}
          className="block max-w-[62%] shrink-0"
        >
          <span className="block truncate text-right text-[11px] tabular-nums text-base-content/70">
            {value}
          </span>
        </Tooltip>
      </div>
      {clampedPercent !== null && (
        <div
          className={`${compact ? "mt-1 h-1" : "mt-2 h-1.5"} w-full overflow-hidden rounded-full bg-base-300`}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clampedPercent)}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor(clampedPercent)}`}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      )}
      {showDetail && detail && (
        <p
          className="mt-1 truncate text-[10px] text-base-content/50"
          title={detail}
        >
          {detail}
        </p>
      )}
    </div>
  );
}

function UsageMetricValue({ metric }) {
  const clampedPercent = clampPercent(metric.percent);

  return (
    <div className="min-w-0">
      <Tooltip
        text={typeof metric.value === "string" ? metric.value : String(metric.value ?? "")}
        className="block min-w-0"
      >
        <span className="block truncate text-[11px] tabular-nums text-base-content/70">
          {metric.value}
        </span>
      </Tooltip>
      {clampedPercent !== null && (
        <div
          className="mt-1 h-1 w-full overflow-hidden rounded-full bg-base-300"
          role="progressbar"
          aria-label={metric.label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clampedPercent)}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor(clampedPercent)}`}
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function UsageDetailsCard({
  label,
  primary,
  sections = [],
  collapsedMetrics: collapsedOverride,
  collapsedColumns = false,
  expandedTable = false,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const metrics = sections.flatMap((section) => section.metrics);
  const groups = [];
  sections.forEach((section) => {
    const groupKey = section.groupKey ?? section.key;
    let group = groups.find((item) => item.key === groupKey);
    if (!group) {
      group = {
        key: groupKey,
        label: section.groupLabel ?? null,
        sections: [],
      };
      groups.push(group);
    }
    group.sections.push(section);
  });

  const tableSections = [];
  const tableSectionByKey = new Map();
  if (expandedTable) {
    groups.forEach((group) => {
      group.sections.forEach((section) => {
        const sectionKey =
          section.alignKey ?? section.key.replace(`${group.key}_`, "");
        let tableSection = tableSectionByKey.get(sectionKey);
        if (!tableSection) {
          tableSection = {
            key: sectionKey,
            title: section.title,
            rows: [],
            rowByKey: new Map(),
          };
          tableSectionByKey.set(sectionKey, tableSection);
          tableSections.push(tableSection);
        }

        section.metrics.forEach((metric) => {
          const metricKey =
            metric.alignKey ?? metric.key.replace(`${group.key}_`, "");
          let row = tableSection.rowByKey.get(metricKey);
          if (!row) {
            row = { key: metricKey, label: metric.label, values: new Map() };
            tableSection.rowByKey.set(metricKey, row);
            tableSection.rows.push(row);
          }
          row.values.set(group.key, metric);
        });
      });
    });
  }
  const tableGridStyle = {
    gridTemplateColumns: `minmax(0, 1.1fr) repeat(${groups.length}, minmax(0, 1fr))`,
  };

  const criticalMetrics = metrics.filter((metric) => {
    const percent = clampPercent(metric.percent);
    return percent !== null && percent >= NEAR_EXHAUSTED_PERCENT;
  });

  const collapsedMetrics =
    collapsedOverride ??
    (primary
      ? [
          primary,
          ...criticalMetrics.filter((metric) => metric.key !== primary.key),
        ]
      : criticalMetrics);

  const canExpand = metrics.length > 0;
  if (!metrics.length) return null;

  return (
    <div className="w-full min-w-0 rounded-xl bg-base-200 px-3 py-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={canExpand ? isOpen : undefined}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="min-w-0 truncate text-[11px] font-medium text-base-content">
          {label}
        </span>
        {canExpand && (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-base-content/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen ? (
        expandedTable ? (
          <div className="mt-2">
            <div
              className="grid items-baseline gap-2 border-b border-base-300 pb-1"
              style={tableGridStyle}
            >
              <span aria-hidden="true" />
              {groups.map((group) => (
                <span
                  key={group.key}
                  className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide text-base-content/70"
                  title={group.label ?? undefined}
                >
                  {group.label}
                </span>
              ))}
            </div>
            {tableSections.map((section) => (
              <div key={section.key} className="mt-2">
                <p
                  className="truncate text-[10px] font-semibold uppercase tracking-wide text-base-content/50"
                  title={section.title}
                >
                  {section.title}
                </p>
                <div className="mt-1 flex flex-col gap-1.5">
                  {section.rows.map((row) => (
                    <div
                      key={row.key}
                      className="grid items-baseline gap-2"
                      style={tableGridStyle}
                    >
                      <span
                        className="min-w-0 truncate text-[11px] font-medium text-base-content"
                        title={row.label}
                      >
                        {row.label}
                      </span>
                      {groups.map((group) => {
                        const metric = row.values.get(group.key);
                        return metric ? (
                          <UsageMetricValue key={group.key} metric={metric} />
                        ) : (
                          <span key={group.key} />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.key} className="min-w-0">
                {group.label && (
                  <p
                    className="mb-1.5 truncate text-[10px] font-semibold uppercase tracking-wide text-base-content/70"
                    title={group.label}
                  >
                    {group.label}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {group.sections.map((section) => (
                    <div key={section.key} className="min-w-0">
                      <p
                        className="mb-1 truncate text-[10px] font-semibold uppercase tracking-wide text-base-content/50"
                        title={section.title}
                      >
                        {section.title}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {section.metrics.map((metric) => (
                          <UsageMetricRow
                            key={metric.key}
                            label={metric.label}
                            value={metric.value}
                            percent={metric.percent}
                            detail={metric.detail}
                            inlineDetail={metric.inlineDetail}
                            showDetail
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div
          className={
            collapsedColumns && collapsedMetrics.length > 1
              ? "mt-1.5 grid grid-cols-2 gap-2"
              : "mt-1.5 flex flex-col gap-1.5"
          }
        >
          {collapsedMetrics.map((metric) => (
            <UsageMetricRow
              key={metric.key}
              label={metric.label}
              value={metric.value}
              percent={metric.percent}
              detail={metric.detail}
              inlineDetail={metric.inlineDetail}
              showDetail={false}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}
