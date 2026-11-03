/**
 * POSIX-style path helpers for the browser virtual file system.
 *
 * The VFS root is the single path "/". Every other path is absolute, has no
 * trailing slash and is unique. Backslashes are accepted and normalised so
 * pasted Windows paths behave predictably.
 */

export class PathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathError";
  }
}

export function normalizePath(input: unknown, fallback = "/"): string {
  let value = typeof input === "string" ? input : fallback;
  value = value.trim().replace(/\\/g, "/");
  if (value === "") value = fallback;
  if (value.includes("\0")) throw new PathError("Path contains an invalid character");
  if (!value.startsWith("/")) value = `/${value}`;

  const segments: string[] = [];
  for (const segment of value.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      throw new PathError('Path must not contain ".."');
    }
    segments.push(segment);
  }
  return segments.length ? `/${segments.join("/")}` : "/";
}

export function isRootPath(path: string): boolean {
  return normalizePath(path) === "/";
}

export function parentPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
}

export function baseName(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function joinPath(...parts: unknown[]): string {
  const combined = parts
    .filter((part) => typeof part === "string" && part.trim() !== "")
    .join("/");
  return normalizePath(combined, "/");
}

export function isWithinPath(root: string, path: string): boolean {
  const normalizedRoot = normalizePath(root);
  const normalizedPath = normalizePath(path);
  return (
    normalizedRoot === "/" ||
    normalizedPath === normalizedRoot ||
    normalizedPath.startsWith(`${normalizedRoot}/`)
  );
}

/**
 * Resolve an agent/user-supplied path inside a workspace. A leading slash is
 * relative to the workspace root, not the VFS root, which matches how people
 * normally think about a project folder.
 */
export function resolveWorkspacePath(root: string, input: unknown, fallback = "."): string {
  const normalizedRoot = normalizePath(root);
  let value = typeof input === "string" ? input.trim() : fallback;
  if (value === "") value = fallback;
  value = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (value === "" || value === ".") return normalizedRoot;
  const absolute = joinPath(normalizedRoot, value);
  if (!isWithinPath(normalizedRoot, absolute)) {
    throw new PathError("Path escapes the workspace root");
  }
  return absolute;
}

export function relativeToRoot(root: string, absolutePath: string): string {
  const normalizedRoot = normalizePath(root);
  const normalizedPath = normalizePath(absolutePath);
  if (normalizedPath === normalizedRoot) return ".";
  if (normalizedRoot === "/") return normalizedPath.slice(1) || ".";
  if (!normalizedPath.startsWith(`${normalizedRoot}/`)) return normalizedPath;
  return normalizedPath.slice(normalizedRoot.length + 1);
}

export function slugifyWorkspaceName(name: unknown): string {
  const value = typeof name === "string" ? name : "";
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "workspace";
}

const RESERVED_WINDOWS_NAMES = new Set([
  "con", "prn", "aux", "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

export function validateSegment(name: unknown): string | null {
  if (typeof name !== "string") return "Name is required";
  const value = name.trim();
  if (!value) return "Name is required";
  if (value === "." || value === "..") return "Invalid name";
  if (/[\\/]/.test(value)) return "Name cannot contain slashes";
  if (/[\u0000-\u001f]/.test(value)) return "Name contains invalid characters";
  if (value.length > 120) return "Name is too long";
  if (RESERVED_WINDOWS_NAMES.has(value.toLowerCase())) {
    return "This name is reserved";
  }
  return null;
}
