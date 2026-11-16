import { useEffect, useRef, useState } from "react";
import { ArrowUp, Folder } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import { parentPath } from "../../workspace/paths";

export type FolderChoice = { path: string; name: string };

type FolderPickerPanelProps = {
  /**
   * The selected folder. The list shows its subfolders and navigating replaces the selection, so
   * the picker needs no separate confirm step.
   */
  path: string;
  /** Loads the folders inside `path`. Only a path change triggers a reload. */
  load: (path: string) => Promise<FolderChoice[]>;
  onChange: (path: string) => void;
  /** Extra line under the list, e.g. the mount path the selection produces. */
  footer?: string;
  testId?: string;
};

/**
 * Directory list for the Add folder dialog. It is always expanded, lists only folders, and clicking
 * one selects it (and descends into it), so both paths are chosen by browsing instead of typing.
 */
export default function FolderPickerPanel({
  path,
  load,
  onChange,
  footer,
  testId,
}: FolderPickerPanelProps) {
  const { t } = useTranslation();
  const [folders, setFolders] = useState<FolderChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    loadRef
      .current(path)
      .then((entries) => {
        if (!cancelled) setFolders(entries);
      })
      .catch((event) => {
        if (cancelled) return;
        setFolders([]);
        setError(event instanceof Error ? event.message : String(event));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const parent = parentPath(path);

  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-base-300 bg-base-200/40 p-2 text-xs"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(parent)}
          disabled={path === "/"}
          className="btn btn-ghost btn-xs btn-square"
          title={t("workspace.folder_picker_up")}
          aria-label={t("workspace.folder_picker_up")}
        >
          <ArrowUp size={13} />
        </button>
        <span
          data-testid="folder-picker-current"
          className="min-w-0 flex-1 truncate font-mono"
          title={path}
        >
          {path}
        </span>
      </div>

      <div className="mt-1 max-h-40 min-h-[2rem] overflow-y-auto">
        {loading ? (
          <p className="px-1 py-1 text-base-content/50">
            {t("workspace.folder_picker_loading")}
          </p>
        ) : error ? (
          <p className="px-1 py-1 text-error">
            <span className="font-medium">
              {t("workspace.folder_picker_error")}
            </span>{" "}
            <span className="break-words">{error}</span>
          </p>
        ) : folders.length === 0 ? (
          <p className="px-1 py-1 text-base-content/50">
            {t("workspace.folder_picker_empty")}
          </p>
        ) : (
          folders.map((folder) => (
            <button
              key={folder.path}
              type="button"
              onClick={() => onChange(folder.path)}
              className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left transition hover:bg-base-200"
              title={folder.path}
            >
              <Folder size={13} className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate">{folder.name}</span>
            </button>
          ))
        )}
      </div>

      {footer && (
        <p className="mt-1 truncate font-mono text-[10px] text-base-content/70">
          {footer}
        </p>
      )}
    </div>
  );
}
