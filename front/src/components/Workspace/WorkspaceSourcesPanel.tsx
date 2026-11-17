import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Locked, TrashCan, Unlocked } from "@carbon/icons-react";
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  ChevronRight,
  FileText,
  Folder,
  HardDrive,
  MessageSquare,
  Plus,
} from "lucide-react";

import { useConversationList } from "../../db";
import type {
  SourceKind,
  WorkspaceFileEntry,
  WorkspaceSourceRow,
} from "../../db/dbTypes";
import { chatStorageDir } from "../../workspace/chatStorage";
import { normalizePath, parentPath } from "../../workspace/paths";
import type { FileProvider } from "../../workspace/providers/types";
import { useWorkspaceProviders } from "../../workspace/useWorkspaceProviders";
import { formatBytes } from "../../utils/formatBytes";

export type SourcesSelection = {
  sourceId: string;
  sourceKind: "local" | "chat" | "arcana-filesystem" | "arcana";
  path: string;
  name: string;
  kind: "dir" | "file";
  conversationId?: string;
  title?: string;
};

type DeviceView = { drive: "device"; level: "drives" };
type DeviceSourceView = {
  drive: "device";
  level: "source";
  sourceId: string;
  label: string;
};
type ChatsView = { drive: "chats"; level: "drives" };
type ChatView = {
  drive: "chats";
  level: "chat";
  conversationId: string;
  title: string;
};
type ArcanasView = { drive: "arcanas"; level: "browse" };
type View = DeviceView | DeviceSourceView | ChatsView | ChatView | ArcanasView;

type Row = {
  id: string;
  name: string;
  path: string;
  kind: "dir" | "file";
  size?: number;
  referenceId?: string;
};

type Conversation = {
  id: string;
  title?: string;
};

const selectionKey = (selection: SourcesSelection) =>
  `${selection.sourceKind}|${selection.sourceId}|${selection.path}|${selection.kind}`;

const sortRows = (rows: Row[]): Row[] =>
  rows.sort(
    (a, b) =>
      Number(b.kind === "dir") - Number(a.kind === "dir") ||
      a.name.localeCompare(b.name),
  );

const fromEntries = (entries: WorkspaceFileEntry[]): Row[] =>
  sortRows(
    entries.map((entry) => ({
      id: entry.path || entry.name,
      name: entry.name,
      path: entry.path,
      kind: entry.kind === "dir" ? "dir" : "file",
      size: entry.size,
    })),
  );

async function listProvider(provider: FileProvider, path: string): Promise<Row[]> {
  const page = await provider.list(path || "/");
  return fromEntries(page.entries);
}

async function listChatDirectory(
  conversationId: string,
  path: string,
): Promise<Row[]> {
  let directory = await chatStorageDir(conversationId);
  for (const segment of normalizePath(path).split("/").filter(Boolean)) {
    directory = await directory.getDirectoryHandle(segment);
  }
  const rows: Row[] = [];
  // @ts-expect-error entries() is missing from older DOM typings
  for await (const [name, handle] of directory.entries()) {
    const row: Row = {
      id: name,
      name,
      path: `${normalizePath(path).replace(/\/$/, "")}/${name}`,
      kind: handle.kind === "directory" ? "dir" : "file",
    };
    if (handle.kind === "file") {
      try {
        row.size = (await (handle as FileSystemFileHandle).getFile()).size;
      } catch {
        row.size = undefined;
      }
    }
    rows.push(row);
  }
  return sortRows(rows);
}

function DriveRow({
  dataGuide,
  icon: Icon,
  title,
  onClick,
}: {
  dataGuide: string;
  icon: typeof HardDrive;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-guide={dataGuide}
      onClick={onClick}
      className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-base-300/70 px-2 py-1.5 text-left transition hover:border-accent/40 hover:bg-base-200/60"
    >
      <Icon size={16} className="shrink-0 text-base-content/55" />
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-base-content">
        {title}
      </span>
      <ChevronRight size={14} className="shrink-0 text-base-content/35" />
    </button>
  );
}

export default function WorkspaceSourcesPanel({
  sources,
  onAddSource,
  onAddToWorkspace,
  onAddDeviceFolder,
  onRemoveSource,
  onToggleSourceReadOnly,
  busy = false,
}: {
  workspaceId?: string;
  sources: WorkspaceSourceRow[];
  onAddSource: () => void;
  onAddToWorkspace: (selection: SourcesSelection[]) => Promise<void> | void;
  onAddDeviceFolder?: () => void;
  onRemoveSource?: (source: WorkspaceSourceRow) => void;
  onToggleSourceReadOnly?: (source: WorkspaceSourceRow) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const { providers } = useWorkspaceProviders(sources);
  const conversations = (useConversationList() || []) as Conversation[];
  const [view, setView] = useState<View | null>(null);
  const [path, setPath] = useState("/");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Map<string, SourcesSelection>>(
    new Map(),
  );
  const [adding, setAdding] = useState(false);

  const localSources = useMemo(
    () => sources.filter((source) => source.kind === "local"),
    [sources],
  );
  const localById = useMemo(
    () => new Map(localSources.map((source) => [source.id, source])),
    [localSources],
  );
  const arcanaSource = useMemo(
    () =>
      sources.find((source) => source.kind === "arcana-filesystem") ??
      sources.find((source) => source.kind === "arcana") ??
      null,
    [sources],
  );
  const conversationTitle = useCallback(
    (conversation: Conversation) =>
      conversation.title?.trim() || t("workspace.source_browser.untitled_chat"),
    [t],
  );

  useEffect(() => {
    let cancelled = false;

    if (!view) {
      setRows([]);
      setLoading(false);
      setError("");
      return;
    }

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        let next: Row[] = [];
        if (view.drive === "device" && view.level === "drives") {
          next = sortRows(
            localSources.map((source) => ({
              id: source.id,
              referenceId: source.id,
              name: source.label?.trim() || source.id,
              path: "/",
              kind: "dir" as const,
            })),
          );
        } else if (view.drive === "device") {
          const source = localById.get(view.sourceId);
          if (!source) throw new Error(t("workspace.source_browser.unavailable"));
          const provider = providers.get(source.id);
          if (!provider) return;
          next = await listProvider(provider, path);
        } else if (view.drive === "chats" && view.level === "drives") {
          next = sortRows(
            conversations.map((conversation) => {
              const title = conversationTitle(conversation);
              return {
                id: conversation.id,
                referenceId: conversation.id,
                name: title,
                path: "/",
                kind: "dir" as const,
              };
            }),
          );
        } else if (view.drive === "chats") {
          next = await listChatDirectory(view.conversationId, path);
        } else if (!arcanaSource) {
          throw new Error(t("workspace.source_browser.unavailable"));
        } else {
          const provider = providers.get(arcanaSource.id);
          if (!provider) return;
          next = await listProvider(provider, path);
        }
        if (!cancelled) {
          setRows(next);
          setLoading(false);
        }
      } catch (reason) {
        if (!cancelled) {
          setRows([]);
          setError(reason instanceof Error ? reason.message : String(reason));
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    view,
    path,
    providers,
    localSources,
    localById,
    conversations,
    conversationTitle,
    arcanaSource,
    t,
  ]);

  const selectionFor = useCallback(
    (row: Row): SourcesSelection | null => {
      if (!view) return null;
      if (view.drive === "device") {
        if (view.level === "drives") {
          const source = row.referenceId
            ? localById.get(row.referenceId)
            : undefined;
          if (!source) return null;
          return {
            sourceId: source.id,
            sourceKind: "local",
            path: "/",
            name: row.name,
            kind: "dir",
            title: row.name,
          };
        }
        return {
          sourceId: view.sourceId,
          sourceKind: "local",
          path: row.path,
          name: row.name,
          kind: row.kind,
          title: row.kind === "dir" ? row.name : undefined,
        };
      }
      if (view.drive === "chats") {
        if (view.level === "drives") {
          if (!row.referenceId) return null;
          return {
            sourceId: `chat:${row.referenceId}`,
            sourceKind: "chat",
            path: "/",
            name: row.name,
            kind: "dir",
            conversationId: row.referenceId,
            title: row.name,
          };
        }
        return {
          sourceId: `chat:${view.conversationId}`,
          sourceKind: "chat",
          path: row.path,
          name: row.name,
          kind: row.kind,
          conversationId: view.conversationId,
          title: row.kind === "dir" ? row.name : view.title,
        };
      }
      if (!arcanaSource) return null;
      const sourceKind: Extract<SourceKind, "arcana" | "arcana-filesystem"> =
        arcanaSource.kind === "arcana" ? "arcana" : "arcana-filesystem";
      return {
        sourceId: arcanaSource.id,
        sourceKind,
        path: row.path,
        name: row.name,
        kind: row.kind,
        title: row.kind === "dir" ? row.name : undefined,
      };
    },
    [view, localById, arcanaSource],
  );

  const visibleItems = useMemo(
    () =>
      rows
        .map((row) => ({ row, selection: selectionFor(row) }))
        .filter(
          (item): item is { row: Row; selection: SourcesSelection } =>
            item.selection !== null,
        ),
    [rows, selectionFor],
  );
  const allVisibleSelected =
    visibleItems.length > 0 &&
    visibleItems.every((item) =>
      selected.has(selectionKey(item.selection)),
    );

  const toggleSelection = (selection: SourcesSelection, checked: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      const key = selectionKey(selection);
      if (checked) next.set(key, selection);
      else next.delete(key);
      return next;
    });
  };

  const toggleVisible = (checked: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      for (const item of visibleItems) {
        const key = selectionKey(item.selection);
        if (checked) next.set(key, item.selection);
        else next.delete(key);
      }
      return next;
    });
  };

  const openDevice = () => {
    setPath("/");
    setView({ drive: "device", level: "drives" });
  };

  const openChats = () => {
    setPath("/");
    setView({ drive: "chats", level: "drives" });
  };

  const openArcanas = () => {
    setPath("/");
    setView({ drive: "arcanas", level: "browse" });
  };

  const openRow = (row: Row) => {
    if (!view) return;
    if (view.drive === "device" && view.level === "drives") {
      const source = row.referenceId
        ? localById.get(row.referenceId)
        : undefined;
      if (source) {
        setPath("/");
        setView({
          drive: "device",
          level: "source",
          sourceId: source.id,
          label: source.label?.trim() || source.id,
        });
      }
      return;
    }
    if (view.drive === "chats" && view.level === "drives") {
      if (row.referenceId) {
        setPath("/");
        setView({
          drive: "chats",
          level: "chat",
          conversationId: row.referenceId,
          title: row.name,
        });
      }
      return;
    }
    if (row.kind === "dir") {
      setPath(row.path);
      return;
    }
    const selection = selectionFor(row);
    if (selection) {
      toggleSelection(selection, !selected.has(selectionKey(selection)));
    }
  };

  const goBack = () => {
    if (!view) return;
    if (view.drive === "device") {
      if (view.level === "source" && path !== "/") {
        setPath(parentPath(path));
        return;
      }
      if (view.level === "source") {
        setPath("/");
        setView({ drive: "device", level: "drives" });
        return;
      }
      setView(null);
      return;
    }
    if (view.drive === "chats") {
      if (view.level === "chat" && path !== "/") {
        setPath(parentPath(path));
        return;
      }
      if (view.level === "chat") {
        setPath("/");
        setView({ drive: "chats", level: "drives" });
        return;
      }
      setView(null);
      return;
    }
    if (path !== "/") {
      setPath(parentPath(path));
      return;
    }
    setView(null);
  };

  const addSelection = async () => {
    if (selected.size === 0 || adding || busy) return;
    setAdding(true);
    try {
      await onAddToWorkspace(Array.from(selected.values()));
      setSelected(new Map());
    } catch {
      return;
    } finally {
      setAdding(false);
    }
  };

  const driveName = view
    ? view.drive === "device"
      ? t("workspace.source_browser.device")
      : view.drive === "chats"
        ? t("workspace.source_browser.chats")
        : t("workspace.source_browser.arcanas")
    : "";
  const breadcrumb = view
    ? [
        view.drive === "device" && view.level === "source" ? view.label : "",
        view.drive === "chats" && view.level === "chat" ? view.title : "",
        ...normalizePath(path).split("/").filter(Boolean),
      ]
        .filter(Boolean)
        .join(" / ") || "/"
    : "/";
  const pending = adding || busy;

  return (
    <section
      data-guide="workspace-sources"
      className="min-w-0 rounded-xl border border-base-300 bg-base-100 p-1.5"
    >
      <div className="flex items-center justify-between px-1 py-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
          {t("workspace.source_browser.title")}
        </span>
        <button
          type="button"
          data-guide="workspace-sources-add"
          onClick={onAddSource}
          aria-label={t("workspace.add_source")}
          title={t("workspace.add_source")}
          className="flex h-5 w-5 items-center justify-center rounded text-base-content/55 transition hover:bg-base-200 hover:text-base-content"
        >
          <Plus size={14} />
        </button>
      </div>

      {!view ? (
        <div className="mt-1 flex flex-col gap-1">
          <DriveRow
            dataGuide="workspace-source-device"
            icon={HardDrive}
            title={t("workspace.source_browser.device")}
            onClick={openDevice}
          />
          <DriveRow
            dataGuide="workspace-source-chats"
            icon={MessageSquare}
            title={t("workspace.source_browser.chats")}
            onClick={openChats}
          />
          <DriveRow
            dataGuide="workspace-source-arcanas"
            icon={Boxes}
            title={t("workspace.source_browser.arcanas")}
            onClick={openArcanas}
          />
        </div>
      ) : (
        <div className="mt-1 flex min-w-0 flex-col overflow-hidden">
          <div className="flex min-w-0 items-center gap-1 border-b border-base-300 px-1 py-1">
            <button
              type="button"
              onClick={goBack}
              aria-label={t("workspace.source_browser.back")}
              title={t("workspace.source_browser.back")}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/55 transition hover:bg-base-200 hover:text-base-content"
            >
              <ArrowLeft size={14} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-semibold leading-tight text-base-content">
                {driveName}
              </div>
              <div
                className="truncate text-[10px] leading-tight text-base-content/50"
                title={breadcrumb}
              >
                {breadcrumb}
              </div>
            </div>
            {visibleItems.length > 0 && (
              <label
                className="flex shrink-0 items-center gap-1 text-[10px] text-base-content/55"
                title={t("workspace.source_browser.select_all")}
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={allVisibleSelected}
                  onChange={(event) => toggleVisible(event.target.checked)}
                  aria-label={t("workspace.source_browser.select_all")}
                />
                <span className="hidden min-[280px]:inline">
                  {t("workspace.source_browser.select_all")}
                </span>
              </label>
            )}
          </div>

          <div className="max-h-72 min-w-0 overflow-y-auto overflow-x-hidden p-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-[11px] text-base-content/50">
                <span className="loading loading-spinner loading-xs" />
                <span className="truncate">{t("workspace.source_browser.loading")}</span>
              </div>
            ) : error ? (
              <div className="flex items-start gap-1.5 p-2 text-[11px] text-error">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">{error}</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 p-4 text-center text-[11px] text-base-content/50">
                <Folder size={18} className="text-base-content/30" />
                <span className="truncate">{t("workspace.source_browser.empty")}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {visibleItems.map(({ row, selection }) => {
                  const checked = selected.has(selectionKey(selection));
                  const source =
                    view.drive === "device" &&
                    view.level === "drives" &&
                    row.referenceId
                      ? localById.get(row.referenceId)
                      : undefined;
                  return (
                    <div
                      key={row.id}
                      className="group flex min-w-0 items-center gap-1 rounded-lg px-1 py-1 transition hover:bg-base-200/60"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs shrink-0"
                        checked={checked}
                        onChange={(event) =>
                          toggleSelection(selection, event.target.checked)
                        }
                        aria-label={row.name}
                      />
                      <button
                        type="button"
                        onClick={() => openRow(row)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        {row.kind === "dir" ? (
                          <Folder
                            size={14}
                            className="shrink-0 text-accent"
                          />
                        ) : (
                          <FileText
                            size={14}
                            className="shrink-0 text-base-content/45"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate text-[11px] text-base-content">
                          {row.name}
                        </span>
                        {row.kind === "file" && typeof row.size === "number" && (
                          <span className="shrink-0 text-[10px] text-base-content/40">
                            {formatBytes(row.size)}
                          </span>
                        )}
                        {row.kind === "dir" && (
                          <ChevronRight
                            size={12}
                            className="shrink-0 text-base-content/30"
                          />
                        )}
                      </button>
                      {source &&
                        (onToggleSourceReadOnly || onRemoveSource) && (
                          <span className="flex shrink-0 items-center gap-0.5">
                            {source.kind === "local" &&
                              onToggleSourceReadOnly && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onToggleSourceReadOnly(source);
                                  }}
                                  className={`flex h-5 w-5 items-center justify-center rounded text-base-content/40 transition ${
                                    source.readOnly
                                      ? "text-warning"
                                      : "opacity-0 hover:bg-base-200 hover:text-base-content focus-visible:opacity-100 group-hover:opacity-100"
                                  }`}
                                  title={
                                    source.readOnly
                                      ? t("workspace.make_source_writable")
                                      : t("workspace.make_source_read_only")
                                  }
                                  aria-label={
                                    source.readOnly
                                      ? t("workspace.make_source_writable")
                                      : t("workspace.make_source_read_only")
                                  }
                                >
                                  {source.readOnly ? (
                                    <Locked size={12} />
                                  ) : (
                                    <Unlocked size={12} />
                                  )}
                                </button>
                              )}
                            {onRemoveSource && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRemoveSource(source);
                                }}
                                className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-error/10 hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
                                title={t("workspace.remove_source")}
                                aria-label={t("workspace.remove_source")}
                              >
                                <TrashCan size={12} />
                              </button>
                            )}
                          </span>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {view.drive === "device" && view.level === "drives" && (
            <button
              type="button"
              data-guide="workspace-sources-add-device-folder"
              onClick={() => onAddDeviceFolder?.()}
              disabled={!onAddDeviceFolder}
              className="mt-1 flex w-full min-w-0 items-center gap-2 rounded-lg border border-dashed border-base-300 px-2 py-1.5 text-left text-[11px] font-medium text-base-content/70 transition hover:border-accent/40 hover:bg-base-200/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={14} className="shrink-0" />
              <span className="min-w-0 truncate">
                {t("workspace.source_browser.add_device_folder")}
              </span>
            </button>
          )}

          {selected.size > 0 && (
            <div className="sticky bottom-0 z-10 mt-1 flex min-w-0 flex-col gap-1 border-t border-base-300 bg-base-100 px-1 pb-0.5 pt-1.5">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] font-medium text-base-content/70">
                  {t(
                    selected.size === 1
                      ? "workspace.source_browser.selected_one"
                      : "workspace.source_browser.selected_many",
                    { count: selected.size },
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(new Map())}
                  className="shrink-0 rounded px-1 text-[10px] font-semibold text-base-content/50 transition hover:text-base-content"
                >
                  {t("workspace.source_browser.clear")}
                </button>
              </div>
              <button
                type="button"
                data-guide="workspace-add-to-workspace"
                onClick={() => void addSelection()}
                disabled={pending}
                className="btn btn-primary btn-xs w-full min-w-0 gap-1"
              >
                {pending && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                <span className="truncate">
                  {t("workspace.source_browser.add_to_workspace")}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
