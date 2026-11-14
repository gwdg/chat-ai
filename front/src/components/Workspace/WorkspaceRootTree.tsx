import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Document,
  Folder,
  Locked,
  TrashCan,
} from "@carbon/icons-react";

import type { RootEntry } from "../../workspace/workspaceRoot";

type TreeProps = {
  entries: RootEntry[];
  loadChildren: (path: string) => Promise<RootEntry[]>;
  onOpen: (entry: RootEntry) => void;
  onRemoveLocal: (entry: RootEntry) => void;
  onRemoveMount: (entry: RootEntry) => void;
  onToggleMountReadOnly: (entry: RootEntry) => void;
  isReadOnly: (entry: RootEntry) => boolean;
  isSourceReadOnly: (entry: RootEntry) => boolean;
  sourceLabel?: (entry: RootEntry) => string | undefined;
};

function TreeRow({
  entry,
  depth,
  ...props
}: { entry: RootEntry; depth: number } & TreeProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<RootEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const isMount = !!entry.mount;
  const isDir = entry.kind === "dir";
  const expandable = isDir && !isMount;
  const readOnly = props.isReadOnly(entry);
  const sourceReadOnly = props.isSourceReadOnly(entry);

  const toggle = async () => {
    if (!isDir) {
      props.onOpen(entry);
      return;
    }
    if (isMount) {
      props.onOpen(entry);
      return;
    }
    setOpen((current) => !current);
    if (!open && children === null) {
      setLoading(true);
      try {
        setChildren(await props.loadChildren(entry.path));
      } finally {
        setLoading(false);
      }
    }
    props.onOpen(entry);
  };

  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded-md pr-1 text-[11px] hover:bg-base-200"
        style={{ paddingLeft: 4 + depth * 10 }}
      >
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-1 py-0.5 text-left"
          title={entry.path}
        >
          {expandable ? (
            open ? (
              <ChevronDown size={12} className="shrink-0 text-base-content/50" />
            ) : (
              <ChevronRight size={12} className="shrink-0 text-base-content/50" />
            )
          ) : (
            <span className="w-3 shrink-0" />
          )}
          {isDir ? (
            <Folder size={13} className="shrink-0 text-accent" />
          ) : (
            <Document size={13} className="shrink-0 text-base-content/50" />
          )}
          <span className="min-w-0 flex-1 truncate text-base-content">
            {entry.name}
          </span>
          {isMount && props.sourceLabel?.(entry) && (
            <span className="shrink-0 text-[9px] font-semibold text-base-content/55">
              {props.sourceLabel?.(entry)}
            </span>
          )}
        </button>
        {entry.local ? (
          <button
            type="button"
            onClick={() => props.onRemoveLocal(entry)}
            className="flex h-4 w-4 items-center justify-center rounded text-base-content/40 opacity-0 hover:text-error group-hover:opacity-100"
            title={t("workspace.remove_mount")}
            aria-label={t("workspace.remove_mount")}
          >
            <TrashCan size={11} />
          </button>
        ) : isMount ? (
          <>
            {readOnly && (
              <button
                type="button"
                onClick={() => !sourceReadOnly && props.onToggleMountReadOnly(entry)}
                disabled={sourceReadOnly}
                className={`flex h-4 w-4 items-center justify-center rounded text-warning ${
                  sourceReadOnly ? "cursor-default" : "hover:bg-base-200"
                }`}
                title={t("workspace.make_writable")}
                aria-label={t("workspace.make_writable")}
              >
                <Locked size={11} />
              </button>
            )}
            <button
              type="button"
              onClick={() => props.onRemoveMount(entry)}
              className="flex h-4 w-4 items-center justify-center rounded text-base-content/40 opacity-0 hover:text-error group-hover:opacity-100"
              title={t("workspace.remove_mount")}
              aria-label={t("workspace.remove_mount")}
            >
              <TrashCan size={11} />
            </button>
          </>
        ) : null}
      </div>
      {expandable && open && (
        <div>
          {loading && (
            <div
              className="py-0.5 text-[10px] text-base-content/40"
              style={{ paddingLeft: 18 + depth * 10 }}
            >
              …
            </div>
          )}
          {!loading &&
            children?.map((child) => (
              <TreeRow
                key={child.path}
                entry={child}
                depth={depth + 1}
                {...props}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default function WorkspaceRootTree(props: TreeProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {props.entries.map((entry) => (
        <TreeRow key={entry.path} entry={entry} depth={0} {...props} />
      ))}
    </div>
  );
}
