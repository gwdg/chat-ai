export const normalizePath = (path: string): string => {
  const parts = String(path ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== ".");
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

export const isSameOrDescendant = (candidate: string, root: string): boolean =>
  isWithinPath(candidate, root);
