import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import FolderPickerPanel from "../../components/Workspace/FolderPickerPanel";
import { addWorkspaceMount } from "../../db/workspaceDb";
import { createProvider } from "../../workspace/providers";
import { baseName, joinPath, normalizePath } from "../../workspace/paths";
import { createWorkspaceRootProvider } from "../../workspace/workspaceRoot";
import { inspectMountTarget } from "./mountTarget";

/**
 * Reads every page of a directory and keeps only its folders. Provider listings are paginated
 * (Arcana, MCP), and stopping at the first page would hide folders in a large directory.
 */
const listFolders = async (provider, path) => {
  const folders = [];
  let cursor;
  for (let page = 0; page < 20; page += 1) {
    const result = await provider.list(path, cursor);
    for (const entry of result.entries) {
      if (entry.kind === "dir") {
        folders.push({ path: entry.path, name: entry.name });
      }
    }
    cursor = result.next;
    if (!cursor) break;
  }
  return folders;
};

/** The folder name a source root mounts as, e.g. a "Browser storage" source becomes "/Browser
 * storage"; the name is only a label, so path separators are flattened. */
const sourceLeaf = (source) => {
  const label = String(source?.label ?? "")
    .trim()
    .replace(/[\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return label || "folder";
};

export default function AddMountModal({
  isOpen,
  onClose,
  workspaceId,
  sources = [],
  mounts = [],
  initialSourceId,
  onAdded,
}) {
  const { t } = useTranslation();
  const fixedSource = initialSourceId
    ? sources.find((source) => source.id === initialSourceId)
    : undefined;
  const initialSource =
    fixedSource ??
    // "Add folder" from the workspace root adds to its own browser tree, so start there instead of
    // on whichever source happens to sort first (an Arcana source can be unreachable).
    sources.find((source) => source.kind === "browser") ??
    sources[0];
  const [sourceId, setSourceId] = useState(initialSource?.id ?? "");
  const [sourcePath, setSourcePath] = useState("/");
  /** The workspace folder the mount is placed in; its own name comes from the source folder. */
  const [mountParent, setMountParent] = useState("/");
  const [readOnly, setReadOnly] = useState(fixedSource?.readOnly === true);
  const [error, setError] = useState("");
  const [targetProblem, setTargetProblem] = useState(null);
  const [saving, setSaving] = useState(false);

  const currentSource = sources.find((entry) => entry.id === sourceId);
  const mountName =
    baseName(normalizePath(sourcePath)) || sourceLeaf(currentSource);
  const mountPath = joinPath(mountParent, mountName);

  const mountedPaths = useMemo(
    () => mounts.map((mount) => normalizePath(mount.path)),
    [mounts],
  );
  // `mounts` can be a fresh array with unchanged contents, so effects key on the joined paths.
  const mountedSignature = mountedPaths.join("\n");

  const loadSourceFolders = useCallback(
    async (path) => {
      const source = sources.find((entry) => entry.id === sourceId);
      if (!source) throw new Error(t("workspace.mount_source_required"));
      const provider = createProvider(source);
      try {
        await provider.connect();
        return await listFolders(provider, path);
      } finally {
        provider.close?.();
      }
    },
    [sourceId, sources, t],
  );

  const loadWorkspaceFolders = useCallback(
    async (path) => {
      const root = createWorkspaceRootProvider(workspaceId);
      await root.connect();
      const folders = await listFolders(root, path);
      // Mounted folders are virtual entries of the workspace root (see WorkspacePage#listRoot), so
      // a mount can be placed next to them. A mounted folder itself is no destination: opening it
      // shows its source, so a mount put inside would never be reachable.
      const seen = new Set(folders.map((folder) => folder.name));
      const prefix = path === "/" ? "/" : `${path}/`;
      for (const mount of mounts) {
        const mounted = normalizePath(mount.path);
        if (mounted === path || !mounted.startsWith(prefix)) continue;
        const first = mounted.slice(prefix.length).split("/")[0];
        const entryPath = joinPath(path, first);
        if (!first || seen.has(first) || mounted === entryPath) continue;
        seen.add(first);
        folders.push({ path: entryPath, name: first });
      }
      return folders;
    },
    [mounts, workspaceId],
  );

  // Warn while picking, so the conflict is visible before the dialog is submitted.
  useEffect(() => {
    if (!isOpen || !sourceId) return undefined;
    let cancelled = false;
    setTargetProblem(null);
    inspectMountTarget({
      workspaceId,
      path: mountPath,
      mountedPaths: mountedSignature ? mountedSignature.split("\n") : [],
    })
      .then((problem) => {
        if (!cancelled) setTargetProblem(problem);
      })
      .catch(() => {
        // A live hint must not break the dialog; submit reports a real provider failure.
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, sourceId, workspaceId, mountPath, mountedSignature]);

  const submit = async () => {
    if (saving) return;
    if (!sourceId) {
      setError(t("workspace.mount_source_required"));
      return;
    }
    const target = normalizePath(mountPath);
    setError("");
    setSaving(true);
    try {
      const problem = await inspectMountTarget({
        workspaceId,
        path: target,
        mountedPaths,
      });
      if (problem) {
        setTargetProblem(problem);
        return;
      }
      await addWorkspaceMount({
        workspaceId,
        sourceId,
        sourcePath: normalizePath(sourcePath),
        path: target,
        readOnly,
      });
      onAdded?.(target);
      onClose();
    } catch (event) {
      setError(event instanceof Error ? event.message : String(event));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="workspace.add_folder">
      <div className="flex flex-col gap-3 pb-2 text-sm">
        {fixedSource ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-base-content/70">
              {t("workspace.mount_source")}
            </span>
            <p className="rounded-lg border border-base-300 px-3 py-2 text-sm">
              {fixedSource.label}
            </p>
          </div>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-base-content/70">
              {t("workspace.mount_source")}
            </span>
            <select
              value={sourceId}
              onChange={(event) => {
                // A folder path only means something inside its own source.
                setSourceId(event.target.value);
                setSourcePath("/");
              }}
              className="select select-bordered w-full"
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("workspace.mount_source_path")}
          </span>
          <FolderPickerPanel
            testId="folder-picker-source"
            path={sourcePath}
            load={loadSourceFolders}
            onChange={setSourcePath}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("workspace.mount_parent")}
          </span>
          <FolderPickerPanel
            testId="folder-picker-workspace"
            path={mountParent}
            load={loadWorkspaceFolders}
            onChange={setMountParent}
            footer={t("workspace.folder_picker_result", { path: mountPath })}
          />
          {targetProblem && (
            <p data-testid="mount-target-problem" className="text-xs text-error">
              {t(targetProblem.key, targetProblem.values)}
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-base-content/70">
          <input
            type="checkbox"
            checked={readOnly || fixedSource?.readOnly === true}
            onChange={(event) => setReadOnly(event.target.checked)}
            disabled={fixedSource?.readOnly === true}
            className="checkbox checkbox-sm"
          />
          <span>
            {t("workspace.mount_read_only")}
            <span className="ml-1 text-base-content/45">
              {t("workspace.mount_read_only_hint")}
            </span>
          </span>
        </label>
        {error && <p className="text-xs text-error">{error}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={submit}
            disabled={saving || !sourceId || Boolean(targetProblem)}
          >
            {t("workspace.add_folder")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
