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

const formatModified = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function WorkspaceRootBrowser({
  path,
  rootPath = "/",
  breadcrumbs = [],
  entries = [],
  loading = false,
  error = "",
  onNavigate,
  onUp,
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
  upPath,
  dataGuide = "workspace-files",
  selectable = false,
  canSelectEntry,
  selectedPaths = [],
  onToggleSelect,
  onSelectAll,
  selectionActions,
  displayName,
  entryBadge,
}) {
  const { t } = useTranslation();
  const selected = new Set(selectedPaths);
  const labelFor = (entry) => {
    const text = displayName?.(entry);
    return typeof text === "string" ? text : entry.name;
  };
  const badgeFor = (entry) => {
    const badge = entryBadge?.(entry);
    return typeof badge === "string" ? badge : "";
  };
  const selectableEntries = selectable
    ? entries.filter((entry) => !canSelectEntry || canSelectEntry(entry))
    : [];
  const badges = new Map(entries.map((entry) => [entry.path, badgeFor(entry)]));
  const allSelected =
    selectableEntries.length > 0 &&
    selectableEntries.every((entry) => selected.has(entry.path));
  // `upPath` lets the caller steer the ".." row (a mount can have a parent
  // outside the provider's own root). `undefined` keeps the default rule.
  const upTarget =
    upPath !== undefined
      ? upPath
      : path !== rootPath
        ? parentOf(path)
        : null;

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
          <span key={`${index}:${crumb.path}`} className="flex items-center gap-1">
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
          {selectable && onSelectAll && selectableEntries.length > 0 && (
            <label
              className="flex cursor-pointer items-center gap-1"
              title={t("workspace.select_all")}
              data-guide="workspace-select-all"
            >
              <input
                type="checkbox"
                className="checkbox checkbox-xs"
                checked={allSelected}
                onChange={(event) => onSelectAll(event.target.checked)}
                aria-label={t("workspace.select_all")}
              />
            </label>
          )}
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

      {selectable && selectionActions && selectedPaths.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-base-300 bg-base-200/60 px-3 py-1.5 text-xs">
          <span className="font-medium text-base-content">
            {t("workspace.selected_count", { count: selectedPaths.length })}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {selectionActions}
          </div>
        </div>
      )}

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
        ) : (
          <div className="space-y-0.5">
            {upTarget !== null && (
              <button
                type="button"
                onClick={() => (onUp ? onUp() : onNavigate?.(upTarget))}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/70 hover:bg-base-200"
              >
                {selectable && (
                  <span className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
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
                {selectable &&
                  ((!canSelectEntry || canSelectEntry(entry)) ? (
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs shrink-0"
                      checked={selected.has(entry.path)}
                      onChange={(event) =>
                        onToggleSelect?.(entry, event.target.checked)
                      }
                      aria-label={entry.name}
                    />
                  ) : (
                    // Keep the row aligned with selectable rows without
                    // showing a checkbox the user cannot use.
                    <span className="h-3 w-3 shrink-0" aria-hidden="true" />
                  ))}
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
                    {labelFor(entry)}
                  </span>
                  {badges.get(entry.path) && (
                    <span className="shrink-0 rounded-full border border-base-300 px-1.5 py-px text-[9px] font-medium tracking-wide text-base-content/55">
                      {badges.get(entry.path)}
                    </span>
                  )}
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
                  {entry.mtime && (
                    <span
                      className="shrink-0 text-[10px] text-base-content/40"
                      title={new Date(entry.mtime).toLocaleString()}
                    >
                      {formatModified(entry.mtime)}
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
            {entries.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-8 text-center text-xs text-base-content/60">
                <Folder size={20} className="text-base-content/30" />
                <p>{t("workspace.empty_folder")}</p>
                {emptyHint && (
                  <p className="text-[10px] text-base-content/40">{emptyHint}</p>
                )}
              </div>
            )}
          </div>
        )}
        {footer}
      </div>
    </>
  );
}
