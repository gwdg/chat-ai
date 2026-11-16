import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Download, Edit, TrashCan, WarningAltFilled, Workspace } from "@carbon/icons-react";

import BaseModal from "../BaseModal";
import CreateEntryModal from "../Workspace/CreateEntryModal";
import ConfirmActionModal from "../Alert/ConfirmActionModal";
import WorkspaceRootBrowser from "../../components/Workspace/WorkspaceRootBrowser";
import { useToast } from "../../hooks/useToast";
import { useChatWorkspaces, useWorkspaceList } from "../../db/workspaceDb";
import {
  ConversationStorageProvider,
} from "../../workspace/providers/conversation";
import { emptyStream } from "../../workspace/workspaceRoot";
import { joinPath, parentPath } from "../../workspace/paths";
import { storageAccessEnabled } from "../../agent/storageAccess";
import { selectWarning } from "../../Redux/reducers/interfaceSettingsSlice";

const readAll = async (stream) => {
  const reader = stream.getReader();
  const chunks = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      length += value.length;
    }
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return data;
};

/**
 * "Manage data": links a chat attached to a workspace to that workspace's file system, and browses
 * the chat's own browser storage (OPFS) otherwise. The workspace file browser is reused as-is.
 */
export default function ManageDataModal({
  isOpen,
  onClose,
  localState,
  provider: providerProp,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifySuccess, notifyError } = useToast();
  const conversationId = localState?.id;

  const links = useChatWorkspaces(conversationId);
  const workspaces = useWorkspaceList();
  const attached = useMemo(
    () =>
      links
        .map((link) =>
          workspaces.find((workspace) => workspace.id === link.workspaceId),
        )
        .filter(Boolean),
    [links, workspaces],
  );

  const provider = useMemo(
    () =>
      providerProp ??
      (conversationId
        ? new ConversationStorageProvider(
            `conversation:${conversationId}`,
            conversationId,
          )
        : null),
    [providerProp, conversationId],
  );

  const [path, setPath] = useState("/");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef(null);

  const loadEntries = useCallback(async () => {
    if (!provider) return;
    setLoading(true);
    setListError("");
    try {
      if (provider.status !== "connected") await provider.connect();
      const page = await provider.list(path);
      setEntries(page.entries);
    } catch (error) {
      setListError(error instanceof Error ? error.message : String(error));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [provider, path]);

  useEffect(() => {
    setPath("/");
  }, [provider]);

  useEffect(() => {
    if (isOpen) void loadEntries();
  }, [isOpen, loadEntries]);

  const breadcrumbs = useMemo(() => {
    const parts = path.split("/").filter(Boolean);
    return parts.map((part, index) => ({
      label: part,
      path: `/${parts.slice(0, index + 1).join("/")}`,
    }));
  }, [path]);

  // The modal context holds one modal at a time, so create, rename and delete open their dialogs
  // here instead of replacing this one (which would unmount the browser mid-task).
  const [entryDialog, setEntryDialog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const warnDelete = useSelector((state) =>
    selectWarning("warn_workspace_file_delete")(state),
  );

  const createEntry = (kind) => {
    if (!provider) return;
    setEntryDialog({ kind, path });
  };

  const renameEntry = (entry) => {
    if (!provider) return;
    const parent = parentPath(entry.path) || "/";
    setEntryDialog({
      kind: entry.kind,
      path: parent,
      entry,
      initialName: entry.name,
      titleKey: "workspace.rename_entry",
      confirmKey: "common.rename",
    });
  };

  const submitEntry = async (name) => {
    const dialog = entryDialog;
    if (!dialog || !provider) return;
    if (provider.status !== "connected") await provider.connect();
    if (dialog.entry) {
      if (name === dialog.entry.name) return;
      await provider.move(dialog.entry.path, joinPath(dialog.path, name));
    } else {
      const target = joinPath(dialog.path, name);
      if (dialog.kind === "dir") await provider.mkdir(target);
      else await provider.write(target, emptyStream(), { overwrite: false });
    }
    await loadEntries();
  };

  const download = async (entry) => {
    if (!provider || entry.kind !== "file") return;
    try {
      if (provider.status !== "connected") await provider.connect();
      const bytes = await readAll(await provider.read(entry.path));
      const blob = new Blob([bytes], {
        type: entry.mime || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = entry.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    }
  };

  const deleteEntry = async (entry) => {
    if (!provider) return;
    try {
      if (provider.status !== "connected") await provider.connect();
      await provider.remove(entry.path, { recursive: true });
      if (path === entry.path || path.startsWith(`${entry.path}/`)) {
        setPath(parentPath(entry.path));
      } else {
        await loadEntries();
      }
      notifySuccess(t("workspace.delete_success", { name: entry.name }));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    }
  };

  const removeEntry = (entry) => {
    if (!provider) return;
    if (!warnDelete) {
      void deleteEntry(entry);
      return;
    }
    setDeleteTarget(entry);
  };

  const uploadFiles = async (fileList) => {
    if (!provider) return;
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      if (provider.status !== "connected") await provider.connect();
      for (const file of files) {
        await provider.write(joinPath(path, file.name), file.stream(), {
          size: file.size,
          overwrite: true,
        });
      }
      notifySuccess(t("workspace.upload_success", { count: files.length }));
      await loadEntries();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const openEntry = (entry) => {
    if (entry.kind === "dir") {
      setPath(entry.path);
      return;
    }
    void download(entry);
  };

  const entryActions = (entry) => (
    <>
      <button
        type="button"
        onClick={() => renameEntry(entry)}
        className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-base-200 hover:text-base-content group-hover:opacity-100"
        title={t("common.rename")}
        aria-label={t("common.rename")}
      >
        <Edit size={12} />
      </button>
      {entry.kind === "file" && (
        <button
          type="button"
          onClick={() => void download(entry)}
          className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-base-200 hover:text-base-content group-hover:opacity-100"
          title={t("workspace.download")}
          aria-label={t("workspace.download")}
        >
          <Download size={12} />
        </button>
      )}
      <button
        type="button"
        onClick={() => removeEntry(entry)}
        className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-error/10 hover:text-error group-hover:opacity-100"
        title={t("common.delete")}
        aria-label={t("common.delete")}
      >
        <TrashCan size={12} />
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="workspace.manage_data"
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col gap-3 pb-1 text-sm">
        {!storageAccessEnabled(localState?.settings) && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-[11px] leading-relaxed text-base-content/80">
            <WarningAltFilled size={16} className="mt-0.5 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="font-medium">{t("workspace.access_storage")}</p>
              <p className="mt-0.5">{t("workspace.access_storage_off_hint")}</p>
            </div>
          </div>
        )}

        {attached.length > 0 ? (
          <div data-guide="manage-data-workspace" className="space-y-2">
            <p className="text-[11px] leading-relaxed text-base-content/60">
              {t("workspace.manage_data_workspace_hint")}
            </p>
            {attached.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                onClick={() => {
                  onClose?.();
                  navigate(`/workspace/${workspace.id}`);
                }}
                className="flex w-full items-center gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-left text-sm transition hover:bg-base-200"
              >
                <Workspace size={20} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate">
                  {workspace.name}
                </span>
                <span className="shrink-0 text-xs text-accent">
                  {t("workspace.open_workspace")}
                </span>
                <ChevronRight size={14} className="shrink-0 text-base-content/40" />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <div>
              <p className="font-medium">{t("workspace.chat_files")}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-base-content/60">
                {t("workspace.chat_files_hint")}
              </p>
            </div>
            <div className="flex min-h-[18rem] flex-col overflow-hidden rounded-xl border border-base-300">
              <WorkspaceRootBrowser
                dataGuide="manage-data-files"
                path={path}
                rootPath="/"
                breadcrumbs={breadcrumbs}
                entries={entries}
                loading={loading}
                error={listError}
                onNavigate={setPath}
                onBreadcrumb={(crumb) => setPath(crumb.path)}
                onRetry={() => void loadEntries()}
                onOpen={openEntry}
                onUpload={() => uploadRef.current?.click()}
                uploading={uploading}
                onNewFolder={() => createEntry("dir")}
                onNewFile={() => createEntry("file")}
                onRefresh={() => void loadEntries()}
                entryActions={entryActions}
                emptyHint={t("workspace.root_empty_hint")}
              />
              <input
                ref={uploadRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => void uploadFiles(event.target.files)}
              />
            </div>
          </div>
        )}

        <CreateEntryModal
          isOpen={!!entryDialog}
          onClose={() => setEntryDialog(null)}
          kind={entryDialog?.kind ?? "file"}
          path={entryDialog?.path ?? path}
          initialName={entryDialog?.initialName ?? ""}
          titleKey={entryDialog?.titleKey}
          confirmKey={entryDialog?.confirmKey}
          onCreate={submitEntry}
        />
        <ConfirmActionModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          messageKey={
            deleteTarget?.kind === "dir"
              ? "workspace.delete_folder_confirm"
              : "workspace.delete_file_confirm"
          }
          confirmKey="common.delete"
          warningKey="warn_workspace_file_delete"
          danger
          onConfirm={() => void deleteEntry(deleteTarget)}
        />
      </div>
    </BaseModal>
  );
}
