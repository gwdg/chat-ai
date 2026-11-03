import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Add,
  ChevronRight,
  Close,
  Document,
  Download,
  Edit,
  Folder,
  FolderAdd,
  Home,
  Information,
  TrashCan,
  Upload,
  Warning,
} from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import { useVfsChildren } from "../../db/workspaceDb";
import type { VfsNodeRow, WorkspaceRow } from "../../db/dbTypes";
import { createFileSystem } from "../../filesystem";
import {
  joinPath,
  normalizePath,
  relativeToRoot,
  validateSegment,
} from "../../filesystem/paths";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";

function formatBytes(bytes?: number): string {
  if (typeof bytes !== "number") return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(node: VfsNodeRow) {
  return (node.mimeType || "").startsWith("image/");
}

function isText(node: VfsNodeRow) {
  const mime = (node.mimeType || "").toLowerCase();
  if (mime.startsWith("text/")) return true;
  if (mime.includes("json") || mime.includes("xml") || mime.includes("yaml")) return true;
  return /\.(md|txt|json|ya?ml|toml|ini|csv|tsv|jsx?|tsx?|css|html?|py|rb|go|rs|java|c|cpp|h|sh|sql|log)$/i.test(
    node.name,
  );
}

function toBlobUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

function FilePreviewModal({
  node,
  onClose,
}: {
  node: VfsNodeRow;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const fs = useMemo(() => createFileSystem({ mode: "local", rootPath: "/" }), []);
  const [text, setText] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await fs.readFile(node.path);
        if (!blob || cancelled) return;
        if (isImage(node)) {
          const objectUrl = toBlobUrl(blob);
          revoked = objectUrl;
          setUrl(objectUrl);
        } else if (isText(node)) {
          setText(await blob.text());
        }
      } catch (previewError: any) {
        if (!cancelled) setError(previewError?.message || "Could not read this file");
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
    // `fs` is a stable root provider; only the node matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  return (
    <div className="fixed inset-0 z-[1005] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-base-300 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-base-200 text-accent">
            <Document size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">{node.name}</h2>
            <p className="text-xs text-base-content/50">
              {node.mimeType || t("workspace.unknown_type")} · {formatBytes(node.size)}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={onClose}>
            <Close size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-base-200/40 p-4">
          {error ? (
            <p className="text-sm text-error">{error}</p>
          ) : url ? (
            <img src={url} alt={node.name} className="mx-auto max-h-[65vh] object-contain" />
          ) : text !== null ? (
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-base-100 p-3 font-mono text-xs text-base-content/80">
              {text}
            </pre>
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-base-content/50">
              <Information size={28} />
              <p>{t("workspace.preview_unavailable")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceFilesPanel({
  workspace,
  onClose,
  onUploaded,
}: {
  workspace: WorkspaceRow;
  onClose?: () => void;
  onUploaded?: () => void;
}) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const { confirmAction } = useModal();
  const fs = useMemo(() => createFileSystem(workspace), [workspace.mode, workspace.rootPath]);
  const [currentPath, setCurrentPath] = useState(workspace.rootPath);
  const [preview, setPreview] = useState<VfsNodeRow | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragging, setDragging] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCurrentPath(workspace.rootPath);
    setPreview(null);
  }, [workspace.id, workspace.rootPath]);

  const children = useVfsChildren(currentPath);
  const relative = relativeToRoot(workspace.rootPath, currentPath);
  const segments = relative === "." ? [] : relative.split("/");

  const goToBreadcrumb = (index: number) => {
    if (index < 0) {
      setCurrentPath(workspace.rootPath);
      return;
    }
    setCurrentPath(joinPath(workspace.rootPath, ...segments.slice(0, index + 1)));
  };

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files ?? []);
      if (!list.length) return;
      let written = 0;
      for (const file of list) {
        const safeName = file.name.replace(/[\\/]/g, "_");
        if (!safeName) continue;
        await fs.writeFile(joinPath(currentPath, safeName), file, file.type || "application/octet-stream");
        written += 1;
      }
      if (written) {
        notifySuccess(t("workspace.uploaded_files", { count: written }));
        onUploaded?.();
      }
    },
    [currentPath, fs, notifySuccess, onUploaded, t],
  );

  const handleUploadInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      await uploadFiles(event.target.files ?? []);
    } catch (error: any) {
      notifyError(error?.message || t("workspace.upload_error"));
    } finally {
      event.target.value = "";
    }
  };

  const handleCreateFolder = async () => {
    const validation = validateSegment(newFolderName);
    if (validation) {
      notifyError(validation);
      return;
    }
    try {
      await fs.mkdir(joinPath(currentPath, newFolderName.trim()));
      setNewFolderName("");
      setNewFolderOpen(false);
      notifySuccess(t("workspace.folder_created"));
    } catch (error: any) {
      notifyError(error?.message || t("workspace.folder_error"));
    }
  };

  const handleRename = async (node: VfsNodeRow) => {
    const validation = validateSegment(renameValue);
    if (validation) {
      notifyError(validation);
      return;
    }
    try {
      await fs.move(node.path, joinPath(currentPath, renameValue.trim()));
      setRenamingPath(null);
      setRenameValue("");
    } catch (error: any) {
      notifyError(error?.message || t("workspace.rename_error"));
    }
  };

  const handleDelete = (node: VfsNodeRow) => {
    confirmAction(
      {
        warningKey: "warn_delete_workspace_file",
        messageKey: "workspace.delete_file_confirm",
        messageValues: { name: node.name },
        confirmKey: "common.delete",
      },
      async () => {
        try {
          await fs.remove(node.path);
          if (preview?.id === node.id) setPreview(null);
          notifySuccess(t("workspace.file_deleted"));
        } catch (error: any) {
          notifyError(error?.message || t("workspace.delete_error"));
        }
      },
    );
  };

  const handleDownload = async (node: VfsNodeRow) => {
    try {
      const blob = await fs.readFile(node.path);
      if (!blob) throw new Error(t("workspace.file_not_found"));
      const url = toBlobUrl(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = node.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error: any) {
      notifyError(error?.message || t("workspace.download_error"));
    }
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-base-300 bg-base-100 md:w-[21rem] md:shrink-0">
      <div className="flex items-center gap-2 border-b border-base-300 px-3 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-base-200 text-accent">
          <Folder size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{t("workspace.files")}</h2>
          <p className="truncate text-[11px] text-base-content/50">{workspace.rootPath}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          title={t("workspace.new_folder")}
          aria-label={t("workspace.new_folder")}
          onClick={() => setNewFolderOpen((open) => !open)}
        >
          <FolderAdd size={18} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square"
          title={t("workspace.upload")}
          aria-label={t("workspace.upload")}
          onClick={() => uploadRef.current?.click()}
        >
          <Upload size={18} />
        </button>
        {onClose && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square md:hidden"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <Close size={18} />
          </button>
        )}
        <input
          ref={uploadRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleUploadInput}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-base-300 px-3 py-2 text-xs text-base-content/60">
        <button
          type="button"
          onClick={() => goToBreadcrumb(-1)}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-base-200"
        >
          <Home size={13} />
          <span className="max-w-[8rem] truncate">{workspace.name}</span>
        </button>
        {segments.map((segment, index) => (
          <span key={`${segment}-${index}`} className="flex items-center gap-1">
            <ChevronRight size={12} className="text-base-content/40" />
            <button
              type="button"
              onClick={() => goToBreadcrumb(index)}
              className="max-w-[8rem] truncate rounded-md px-1.5 py-1 hover:bg-base-200"
            >
              {segment}
            </button>
          </span>
        ))}
      </div>

      {newFolderOpen && (
        <div className="flex items-center gap-2 border-b border-base-300 bg-base-200/50 px-3 py-2">
          <FolderAdd size={16} className="shrink-0 text-accent" />
          <input
            autoFocus
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleCreateFolder();
              if (event.key === "Escape") setNewFolderOpen(false);
            }}
            placeholder={t("workspace.folder_name")}
            className="input input-sm min-w-0 flex-1 border-base-300 bg-base-100 text-xs"
          />
          <button type="button" className="btn btn-primary btn-xs" onClick={handleCreateFolder}>
            {t("common.create")}
          </button>
        </div>
      )}

      <div
        className={`relative min-h-0 flex-1 overflow-y-auto p-2 ${dragging ? "bg-primary/5" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={async (event) => {
          event.preventDefault();
          setDragging(false);
          try {
            await uploadFiles(event.dataTransfer.files);
          } catch (error: any) {
            notifyError(error?.message || t("workspace.upload_error"));
          }
        }}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-base-100/80 text-sm text-primary">
            <Upload size={24} />
            <span>{t("workspace.drop_files")}</span>
          </div>
        )}

        {children.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-base-200 text-base-content/40">
              <Folder size={20} />
            </span>
            <p className="text-xs text-base-content/50">{t("workspace.folder_empty")}</p>
            <button
              type="button"
              className="btn btn-ghost btn-xs text-accent"
              onClick={() => uploadRef.current?.click()}
            >
              <Add size={14} /> {t("workspace.upload")}
            </button>
          </div>
        ) : (
          <ul className="space-y-1">
            {children.map((node) => {
              const isFolder = node.type === "folder";
              const renaming = renamingPath === node.path;
              return (
                <li
                  key={node.id}
                  className="group flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-base-200"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => {
                      if (isFolder) {
                        setCurrentPath(node.path);
                        setRenamingPath(null);
                      } else {
                        setPreview(node);
                      }
                    }}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                        isFolder ? "bg-accent/10 text-accent" : "bg-base-200 text-base-content/60"
                      }`}
                    >
                      {isFolder ? <Folder size={15} /> : <Document size={15} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      {renaming ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === "Enter") handleRename(node);
                            if (event.key === "Escape") setRenamingPath(null);
                          }}
                          className="input input-xs w-full border-base-300 bg-base-100"
                        />
                      ) : (
                        <span className="block truncate text-xs text-base-content">
                          {node.name}
                        </span>
                      )}
                      {!renaming && (
                        <span className="block text-[10px] text-base-content/45">
                          {isFolder ? t("workspace.folder") : formatBytes(node.size)}
                        </span>
                      )}
                    </span>
                  </button>
                  {!renaming && (
                    <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                      {!isFolder && (
                        <button
                          type="button"
                          className="rounded-md p-1 text-base-content/50 hover:bg-base-300 hover:text-base-content"
                          title={t("workspace.download")}
                          aria-label={t("workspace.download")}
                          onClick={() => handleDownload(node)}
                        >
                          <Download size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded-md p-1 text-base-content/50 hover:bg-base-300 hover:text-base-content"
                        title={t("common.rename")}
                        aria-label={t("common.rename")}
                        onClick={() => {
                          setRenamingPath(node.path);
                          setRenameValue(node.name);
                        }}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1 text-base-content/50 hover:bg-error/10 hover:text-error"
                        title={t("common.delete")}
                        aria-label={t("common.delete")}
                        onClick={() => handleDelete(node)}
                      >
                        <TrashCan size={14} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-base-300 px-3 py-2 text-[10px] text-base-content/45">
        {t("workspace.local_storage_hint")}
      </div>

      {preview && <FilePreviewModal node={preview} onClose={() => setPreview(null)} />}
    </aside>
  );
}
