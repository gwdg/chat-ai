import { normalizePath } from "./paths";

type FolderNameOptions = {
  fallback?: string;
  flattenSeparators?: boolean;
  maxLength?: number;
  rejectEmpty?: boolean;
};

/**
 * Turns a folder label into the name used for a mount. Source labels are only labels, so their
 * path separators are flattened; user-entered target folders stay as a path and may be rejected.
 */
export function folderName(
  value: unknown,
  {
    fallback = "folder",
    flattenSeparators = false,
    maxLength,
    rejectEmpty = false,
  }: FolderNameOptions = {},
): string {
  if (flattenSeparators) {
    const label = String(value ?? "")
      .trim()
      .replace(/[\\/]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return label || fallback;
  }
  const parts = normalizePath(`/${String(value || "").trim()}`)
    .split("/")
    .filter(Boolean);
  if (!parts.length) {
    if (rejectEmpty) throw new Error("Invalid target folder");
    return fallback;
  }
  const name = parts.join("/");
  return maxLength ? name.slice(0, maxLength) : name;
}
