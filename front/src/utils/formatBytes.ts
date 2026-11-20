const UNITS = ["B", "KB", "MB", "GB", "TB"];

type FormatBytesOptions = {
  /** Always show one decimal above bytes, so 15 KiB prints as "15.0 KB". */
  fixedDigits?: boolean;
  /** Stop scaling at this unit index; 3 keeps large values in GB. */
  maxUnit?: number;
};

export function formatBytes(
  bytes: number,
  { fixedDigits = false, maxUnit = UNITS.length - 1 }: FormatBytesOptions = {},
): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const unit = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    maxUnit,
  );
  const value = bytes / Math.pow(1024, unit);
  const digits = unit === 0 ? 0 : fixedDigits || value < 10 ? 1 : 0;
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
}
