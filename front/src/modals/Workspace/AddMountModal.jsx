import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import { addWorkspaceMount } from "../../db/workspaceDb";
import { baseName, normalizePath } from "../../workspace/paths";

export default function AddMountModal({
  isOpen,
  onClose,
  workspaceId,
  sources = [],
  mounts = [],
  onAdded,
}) {
  const { t } = useTranslation();
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [sourcePath, setSourcePath] = useState("/");
  const [mountPath, setMountPath] = useState("/");
  const [readOnly, setReadOnly] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const existingPaths = useMemo(
    () => new Set(mounts.map((mount) => normalizePath(mount.path))),
    [mounts],
  );

  const submit = async () => {
    if (saving) return;
    const normalizedMount = normalizePath(mountPath);
    if (!sourceId) {
      setError(t("workspace.mount_source_required"));
      return;
    }
    if (normalizedMount === "/") {
      setError(t("workspace.mount_path_required"));
      return;
    }
    if (existingPaths.has(normalizedMount)) {
      setError(t("workspace.mount_path_taken"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addWorkspaceMount({
        workspaceId,
        sourceId,
        sourcePath: normalizePath(sourcePath),
        path: normalizedMount,
        readOnly,
      });
      onAdded?.(normalizedMount);
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("workspace.mount_source")}
          </span>
          <select
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
            className="select select-bordered w-full"
          >
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("workspace.mount_source_path")}
          </span>
          <input
            value={sourcePath}
            onChange={(event) => setSourcePath(event.target.value)}
            placeholder="/shoe"
            className="input input-bordered w-full font-mono text-xs"
          />
          <span className="text-[10px] text-base-content/50">
            {t("workspace.mount_source_path_hint")}
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("workspace.mount_path")}
          </span>
          <input
            value={mountPath}
            onChange={(event) => {
              setMountPath(event.target.value);
              setError("");
            }}
            placeholder="/shoe"
            className="input input-bordered w-full font-mono text-xs"
          />
          <span className="text-[10px] text-base-content/50">
            {t("workspace.mount_path_hint", {
              name: baseName(mountPath) || "shoe",
            })}
          </span>
        </label>
        <label className="flex items-center gap-2 text-xs text-base-content/70">
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(event) => setReadOnly(event.target.checked)}
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
            disabled={saving || !sourceId}
          >
            {t("workspace.add_folder")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
