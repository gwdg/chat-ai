const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const unit = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / Math.pow(1024, unit);
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
}
