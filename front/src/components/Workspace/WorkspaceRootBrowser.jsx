import { useTranslation } from "react-i18next";
import {
  Add,
  ChevronRight,
  Folder,
  FolderAdd,
  Home,
  Renew,
  Upload,
  WarningAltFilled,
} from "@carbon/icons-react";

import { baseName, parentPath } from "../../workspace/paths";
import { formatBytes } from "../../utils/formatBytes";

export default function WorkspaceRootBrowser({
  path,
  rootPath = "/",
  breadcrumbs = [],
  entries = [],
  loading = false,
  error = "",
  onNavigate,
  onHome,
  onBreadcrumb,
  onRetry,
  onOpen,
  onUpload,
  uploading = false,
  uploadDisabled = false,
  onNewFolder,
  onNewFile,
  onAddFolder,
  onRefresh,
  newFileEditor,
  toolbarInfo,
  footer,
  entryActions,
  canDragEntry,
  onDragStart,
  onDragEnd,
  onDragOverEntry,
  onDragLeaveEntry,
  onDropEntry,
  onDragOverFiles,
  onDragLeaveFiles,
  onDropFiles,
  isReadOnly,
  sourceLabel,
  emptyHint,
  parentOf = parentPath,
  dataGuide = "workspace-files",
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-b border-base-300 px-3 py-2 text-xs">
        <button
          type="button"
          onClick={() => (onHome ?? (() => onNavigate?.(rootPath)))()}
          className="flex h-5 w-5 items-center justify-center rounded text-base-content/60 hover:bg-base-200"
          title={t("workspace.root")}
        >
          <Home size={14} />
        </button>
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.path} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight size={12} className="text-base-content/30" />
            )}
            <button
              type="button"
              onClick={() =>
                onBreadcrumb
                  ? onBreadcrumb(crumb, index)
                  : onNavigate?.(crumb.path)
              }
              className="max-w-[10rem] truncate rounded px-1 py-0.5 hover:bg-base-200"
            >
              {crumb.label}
            </button>
          </span>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {toolbarInfo}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="btn btn-ghost btn-xs"
              title={t("workspace.retry")}
              aria-label={t("workspace.retry")}
            >
              <Renew size={14} />
            </button>
          )}
          {onUpload && (
            <button
              type="button"
              onClick={onUpload}
              disabled={uploadDisabled || uploading}
              data-guide="workspace-upload"
              className="btn btn-ghost btn-xs"
              title={t("workspace.upload_file")}
            >
              {uploading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Upload size={14} />
              )}
              {t("workspace.upload_file")}
            </button>
          )}
          {onNewFolder && (
            <button
              type="button"
              onClick={onNewFolder}
              className="btn btn-ghost btn-xs"
              title={t("workspace.new_folder")}
            >
              <FolderAdd size={14} />
              {t("workspace.new_folder")}
            </button>
          )}
          {onNewFile && (
            <button
              type="button"
              onClick={onNewFile}
              className="btn btn-ghost btn-xs"
              title={t("workspace.new_file")}
            >
              <Add size={14} />
              {t("workspace.new_file")}
            </button>
          )}
          {onAddFolder && (
            <button
              type="button"
              onClick={onAddFolder}
              className="btn btn-ghost btn-xs"
              title={t("workspace.add_folder")}
            >
              <Folder size={14} />
              {t("workspace.add_folder")}
            </button>
          )}
        </div>
      </div>

      {newFileEditor}

      <div
        data-guide={dataGuide}
        className="flex-1 overflow-y-auto p-1.5"
        onDragOver={onDragOverFiles}
        onDragLeave={onDragLeaveFiles}
        onDrop={onDropFiles}
      >
        {loading && entries.length === 0 ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-8 animate-pulse rounded bg-base-200"
              />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-xs text-base-content/60">
            <WarningAltFilled size={20} className="text-warning" />
            <p>{error}</p>
            {onRetry && (
              <button className="btn btn-xs" onClick={onRetry}>
                {t("workspace.retry")}
              </button>
            )}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-xs text-base-content/60">
            <Folder size={20} className="text-base-content/30" />
            <p>{t("workspace.empty_folder")}</p>
            {emptyHint && (
              <p className="text-[10px] text-base-content/40">{emptyHint}</p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {path !== rootPath && (
              <button
                type="button"
                onClick={() => onNavigate?.(parentOf(path))}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/70 hover:bg-base-200"
              >
                <Folder size={14} />
                ..
              </button>
            )}
            {entries.map((entry) => (
              <div
                key={entry.path}
                draggable={canDragEntry ? canDragEntry(entry) : false}
                onDragStart={
                  onDragStart ? (event) => onDragStart(entry, event) : undefined
                }
                onDragEnd={onDragEnd}
                onDragOver={
                  onDragOverEntry
                    ? (event) => onDragOverEntry(entry, event)
                    : undefined
                }
                onDragLeave={
                  onDragLeaveEntry
                    ? () => onDragLeaveEntry(entry)
                    : undefined
                }
                onDrop={
                  onDropEntry
                    ? (event) => onDropEntry(entry, event)
                    : undefined
                }
                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-base-200"
              >
                <button
                  type="button"
                  onClick={() => onOpen?.(entry)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {entry.kind === "dir" ? (
                    <Folder size={14} className="text-accent" />
                  ) : (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-base-200 text-[8px] font-semibold uppercase text-base-content/50">
                      {baseName(entry.name).split(".").pop()?.slice(0, 3) ||
                        "file"}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-base-content">
                    {entry.name}
                  </span>
                  {sourceLabel?.(entry) && (
                    <span className="shrink-0 text-[10px] font-semibold text-base-content/60">
                      {sourceLabel(entry)}
                    </span>
                  )}
                  {isReadOnly?.(entry) && (
                    <span className="badge badge-warning badge-xs">
                      {t("workspace.mount_read_only")}
                    </span>
                  )}
                  {entry.kind === "file" && typeof entry.size === "number" && (
                    <span className="shrink-0 text-[10px] text-base-content/40">
                      {formatBytes(entry.size)}
                    </span>
                  )}
                </button>
                {entryActions?.(entry)}
              </div>
            ))}
          </div>
        )}
        {footer}
      </div>
    </>
  );
}
