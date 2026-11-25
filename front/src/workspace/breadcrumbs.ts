// Breadcrumbs for a workspace source that was opened through a mount.
//
// A mount is a window into a provider: `/chats/<id>` may show the provider's
// `/`, so the trail has to keep the workspace folders above the mount visible
// and let the user walk back out of the source view.
import { isWithinPath, joinPath, normalizePath, parentPath } from "./paths";

export type SourceCrumb = {
  label: string;
  path: string;
  // "root" crumbs belong to the workspace browser; "source" crumbs switch the
  // path inside the mounted provider.
  mode: "root" | "source";
  target: string;
};

type SourceTrailInput = {
  currentPath: string;
  /** Workspace path of the mount, for example `/chats/<conversation id>`. */
  mountPath?: string | null;
  /** Folder inside the provider that the mount points at. */
  sourcePath?: string | null;
  rootLabel: string;
};

export function buildSourceBreadcrumbs({
  currentPath,
  mountPath,
  sourcePath,
  rootLabel,
}: SourceTrailInput): SourceCrumb[] {
  const items: SourceCrumb[] = [
    { label: rootLabel, path: "/", mode: "root", target: "/" },
  ];
  const mounted = Boolean(mountPath);
  const mount = mounted ? normalizePath(mountPath) : "/";
  const base = mounted ? normalizePath(sourcePath) : "/";

  if (mounted && mount !== "/") {
    const parts = mount.split("/").filter(Boolean);
    let path = "/";
    parts.forEach((part, index) => {
      path = joinPath(path, part);
      const isMountRoot = index === parts.length - 1;
      items.push({
        label: part,
        path,
        // Only the mount itself stays in the source view.
        mode: isMountRoot ? "source" : "root",
        target: isMountRoot ? base : path,
      });
    });
  }

  const current = normalizePath(currentPath);
  const inside = isWithinPath(current, base);
  const relative = inside
    ? current.slice(base === "/" ? 1 : base.length + 1)
    : current.replace(/^\//, "");
  let path = inside ? base : "/";
  for (const part of relative.split("/").filter(Boolean)) {
    path = joinPath(path, part);
    items.push({ label: part, path, mode: "source", target: path });
  }
  return items;
}

/**
 * Target of the ".." row, or `null` when there is no parent to show. At the
 * root of a mounted provider the parent is the mount's folder in the
 * workspace, not the provider's own root.
 */
export function sourceUpPath({
  currentPath,
  mountPath,
  sourcePath,
}: Omit<SourceTrailInput, "rootLabel">): string | null {
  const mounted = Boolean(mountPath);
  const mount = mounted ? normalizePath(mountPath) : "/";
  const base = mounted ? normalizePath(sourcePath) : "/";
  const current = normalizePath(currentPath);

  if (current !== base) {
    return current === "/" ? null : parentPath(current);
  }
  if (mounted) {
    return mount === "/" ? null : parentPath(mount);
  }
  return current === "/" ? null : parentPath(current);
}
