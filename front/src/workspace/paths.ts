/**
 * Normalises to an absolute POSIX-style path. Segments are resolved one by one so
 * "." disappears, ".." removes the previous segment, and a ".." at the root is
 * dropped. Without this, "/a/../../etc" would reach a remote backend unchanged and
 * that backend could resolve it against its own root to "/etc".
 */
export const normalizePath = (path: string): string => {
  const parts: string[] = [];
  for (const part of String(path ?? "")
    .replace(/\\/g, "/")
    .split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return `/${parts.join("/")}`;
};

export const parentPath = (path: string): string => {
  const normalized = normalizePath(path);
  const parts = normalized.split("/").filter(Boolean);
  parts.pop();
  return `/${parts.join("/")}`;
};

export const baseName = (path: string): string => {
  const parts = normalizePath(path).split("/").filter(Boolean);
  return parts.pop() ?? "";
};

export const joinPath = (...parts: string[]): string =>
  normalizePath(parts.filter(Boolean).join("/"));

export const isWithinPath = (path: string, parent: string): boolean => {
  const child = normalizePath(path);
  const root = normalizePath(parent);
  return root === "/" || child === root || child.startsWith(`${root}/`);
};

/** Returns the normalised path when it stays inside `root`, otherwise null. */
export const resolveWithin = (path: string, root: string): string | null => {
  const child = normalizePath(path);
  return isWithinPath(child, root) ? child : null;
};

export const isSameOrDescendant = (candidate: string, root: string): boolean =>
  isWithinPath(candidate, root);
