import { normalizePath } from "../../workspace/paths";
import { createWorkspaceRootProvider } from "../../workspace/workspaceRoot";

export type MountTargetProblem = {
  /** i18n key; the caller renders it with `values`. */
  key: string;
  values: Record<string, string>;
};

/**
 * Why `path` cannot take a new mount, or `null` when it is free.
 *
 * A mount is a window onto another provider, so a path that already holds an entry — or that sits
 * inside or around another mount — would be shadowed by it and the mount would silently disappear
 * from the workspace listing.
 */
export async function inspectMountTarget({
  workspaceId,
  path,
  mountedPaths = [],
}: {
  workspaceId?: string;
  path: string;
  mountedPaths?: string[];
}): Promise<MountTargetProblem | null> {
  if (!workspaceId) return null;
  const target = normalizePath(path);
  const mounted = mountedPaths.map((entry) => normalizePath(entry));

  if (mounted.includes(target)) {
    return { key: "workspace.mount_target_folder", values: { path: target } };
  }
  if (mounted.some((entry) => entry.startsWith(`${target}/`))) {
    return { key: "workspace.mount_target_covers", values: { path: target } };
  }
  const enclosing = mounted.find((entry) => target.startsWith(`${entry}/`));
  if (enclosing) {
    return {
      key: "workspace.mount_target_nested",
      values: { path: target, mount: enclosing },
    };
  }

  const root = createWorkspaceRootProvider(workspaceId);
  try {
    await root.connect();
    const entry = await root.stat(target);
    if (entry.kind !== "dir") {
      return { key: "workspace.mount_target_file", values: { path: target } };
    }
    const page = await root.list(target);
    return page.entries.length
      ? { key: "workspace.mount_target_nonempty", values: { path: target } }
      : { key: "workspace.mount_target_folder", values: { path: target } };
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") return null;
    throw error;
  } finally {
    root.close?.();
  }
}
