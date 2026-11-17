import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import { addWorkspaceMount } from "../../db/workspaceDb";
import type { WorkspaceMountRow } from "../../db/dbTypes";
import { addLocalSource, pickDirectory } from "../../workspace/localWorkspace";
import { folderName } from "../../workspace/folders";
import { normalizePath } from "../../workspace/paths";
import { inspectMountTarget } from "./mountTarget";

type MountLocalFolderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  mounts?: WorkspaceMountRow[];
  onAdded?: (result: {
    sourceId: string;
    mountId: string;
    path: string;
  }) => void;
};

export default function MountLocalFolderModal({
  isOpen,
  onClose,
  workspaceId,
  mounts = [],
  onAdded,
}: MountLocalFolderModalProps) {
  const { t } = useTranslation();
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [label, setLabel] = useState("");
  const [labelEdited, setLabelEdited] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const mountedPaths = useMemo(
    () => mounts.map((mount) => normalizePath(mount.path)),
    [mounts],
  );

  const localBlocker =
    window.isSecureContext === false
      ? t("workspace.local_insecure")
      : !("showDirectoryPicker" in window)
        ? t("workspace.local_unsupported")
        : "";

  const reset = () => {
    setHandle(null);
    setLabel("");
    setLabelEdited(false);
    setReadOnly(false);
    setError("");
    setBusy(false);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const chooseFolder = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const picked = await pickDirectory({
        mode: readOnly ? "read" : "readwrite",
        insecureMessage: t("workspace.local_insecure"),
        unsupportedMessage: t("workspace.local_unsupported"),
        onPickerError: (event) => {
          console.warn(
            "[workspace] directory picker did not return a folder",
            (event as Error)?.name,
            (event as Error)?.message,
          );
        },
      });
      setHandle(picked);
      if (!labelEdited) setLabel(picked.name);
    } catch (event) {
      if ((event as Error)?.name === "AbortError") {
        setError(t("workspace.local_aborted"));
        return;
      }
      setError(event instanceof Error ? event.message : String(event));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (busy || !workspaceId) return;
    setError("");
    setBusy(true);
    try {
      if (!handle) throw new Error(t("workspace.choose_folder_required"));
      const finalLabel = label.trim() || handle.name;
      const target = normalizePath(
        `/${folderName(finalLabel, { maxLength: 120, rejectEmpty: true })}`,
      );
      const problem = await inspectMountTarget({
        workspaceId,
        path: target,
        mountedPaths,
      });
      if (problem) {
        setError(t(problem.key, problem.values));
        return;
      }
      const sourceId = await addLocalSource({
        workspaceId,
        handle,
        label: finalLabel,
        readOnly,
      });
      const mountId = await addWorkspaceMount({
        workspaceId,
        sourceId,
        sourcePath: "/",
        path: target,
        readOnly,
      });
      onAdded?.({ sourceId, mountId, path: target });
      reset();
      onClose();
    } catch (event) {
      setError(event instanceof Error ? event.message : String(event));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={close} titleKey="workspace.mode_local">
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("workspace.source_folder")}
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={chooseFolder}
              disabled={busy || !!localBlocker}
              className="btn btn-sm shrink-0"
            >
              {t("workspace.choose_folder")}
            </button>
            <span
              data-testid="mount-local-folder"
              className={`truncate text-xs ${
                handle ? "text-base-content" : "text-base-content/50"
              }`}
              title={handle?.name}
            >
              {handle ? handle.name : t("workspace.no_folder_chosen")}
            </span>
          </div>
        </div>

        {localBlocker && (
          <p className="text-xs leading-relaxed text-error">{localBlocker}</p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-base-content/70">
            {t("workspace.source_label")}
          </span>
          <input
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              setLabelEdited(true);
            }}
            placeholder={handle?.name || t("workspace.kind_local")}
            aria-label={t("workspace.source_label")}
            className="input input-bordered w-full"
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-base-content/70">
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(event) => setReadOnly(event.target.checked)}
            className="checkbox checkbox-sm"
          />
          <span>
            {t("workspace.source_read_only")}
            <span className="ml-1 text-base-content/45">
              {t("workspace.source_read_only_hint")}
            </span>
          </span>
        </label>

        <p className="text-xs leading-relaxed text-base-content/60">
          {t("workspace.mount_local_hint")}
        </p>
        {handle && (
          <p className="truncate font-mono text-[11px] text-base-content/50">
            {normalizePath(
              `/${folderName(label.trim() || handle.name, {
                maxLength: 120,
                rejectEmpty: true,
              })}`,
            )}
          </p>
        )}

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={close}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={submit}
            disabled={busy || !handle}
          >
            {t("workspace.mount_local_action")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
