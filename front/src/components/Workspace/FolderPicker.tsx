import { useMemo, useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderAdd,
  Home,
  Checkmark,
} from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import { useVfsChildren } from "../../db/workspaceDb";
import { joinPath, baseName, isRootPath, validateSegment } from "../../filesystem/paths";
import { createFileSystem } from "../../filesystem";
import { useToast } from "../../hooks/useToast";

export default function FolderPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (path: string) => void;
}) {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const [currentPath, setCurrentPath] = useState("/");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const fs = useMemo(() => createFileSystem({ mode: "local", rootPath: "/" }), []);
  const children = useVfsChildren(currentPath);

  const segments = currentPath === "/" ? [] : currentPath.slice(1).split("/");

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
    } catch (error: any) {
      notifyError(error?.message || t("workspace.folder_error"));
    }
  };

  return (
    <div className="rounded-2xl border border-base-300 bg-base-200/40">
      <div className="flex flex-wrap items-center gap-1 border-b border-base-300 px-2 py-2 text-xs text-base-content/60">
        <button
          type="button"
          onClick={() => setCurrentPath("/")}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-base-200"
        >
          <Home size={13} />
          <span>{t("workspace.root_folder")}</span>
        </button>
        {segments.map((segment, index) => (
          <span key={`${segment}-${index}`} className="flex items-center gap-1">
            <ChevronRight size={12} className="text-base-content/40" />
            <button
              type="button"
              onClick={() => setCurrentPath(joinPath("/", ...segments.slice(0, index + 1)))}
              className="max-w-[9rem] truncate rounded-md px-1.5 py-1 hover:bg-base-200"
            >
              {segment}
            </button>
          </span>
        ))}
        <span className="ml-auto text-[10px] text-base-content/45">
          {t("workspace.pick_folder_hint")}
        </span>
      </div>

      {newFolderOpen && (
        <div className="flex items-center gap-2 border-b border-base-300 bg-base-100 px-2 py-2">
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

      <div className="max-h-52 overflow-y-auto p-1.5">
        {children.filter((node) => node.type === "folder").length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-base-content/45">
            <Folder size={16} />
            {t("workspace.no_subfolders")}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {children
              .filter((node) => node.type === "folder")
              .map((folder) => {
                const selected = value === folder.path;
                return (
                  <li key={folder.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPath(folder.path)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-base-200"
                    >
                      <Folder size={15} className="shrink-0 text-accent" />
                      <span className="truncate">{baseName(folder.path)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(folder.path)}
                      className={`btn btn-xs ${selected ? "btn-primary" : "btn-ghost"}`}
                    >
                      {selected ? <Checkmark size={13} /> : t("workspace.select_folder")}
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-base-300 px-2 py-2">
        <button
          type="button"
          className="btn btn-ghost btn-xs gap-1 text-accent"
          onClick={() => setNewFolderOpen((open) => !open)}
        >
          <FolderAdd size={14} />
          {t("workspace.new_folder")}
        </button>
        <div className="flex items-center gap-2">
          <span className="max-w-[12rem] truncate text-[11px] text-base-content/50">
            {isRootPath(currentPath) ? t("workspace.root_not_selectable") : currentPath}
          </span>
          <button
            type="button"
            disabled={isRootPath(currentPath)}
            onClick={() => onSelect(currentPath)}
            className="btn btn-primary btn-xs"
          >
            {t("workspace.use_this_folder")}
          </button>
        </div>
      </div>
    </div>
  );
}
