import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Locked, TrashCan, Unlocked } from "@carbon/icons-react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  Folder,
  MessageSquare,
  Plus,
} from "lucide-react";

import { useConversationList } from "../../db";
import type {
  SourceKind,
  WorkspaceFileEntry,
  WorkspaceSourceRow,
} from "../../db/dbTypes";
import { normalizePath, parentPath } from "../../workspace/paths";
import type {
  FileProvider,
  QuotaInfo,
} from "../../workspace/providers/types";
import { useWorkspaceProviders } from "../../workspace/useWorkspaceProviders";
import { formatBytes } from "../../utils/formatBytes";

export type SourcesSelection = {
  sourceId: string;
  sourceKind: "local" | "chat" | "arcana-filesystem" | "arcana" | "mcp";
  path: string;
  name: string;
  kind: "dir" | "file";
  conversationId?: string;
  title?: string;
};

export type SourceTarget =
  | { drive: "device"; sourceId?: string }
  | { drive: "chats"; conversationId?: string }
  | { drive: "arcanas" }
  | { drive: "mcp" };

type DeviceView = { drive: "device"; level: "drives" };
type DeviceSourceView = {
  drive: "device";
  level: "source";
  sourceId: string;
  label: string;
};
type McpView = { drive: "mcp"; level: "drives" };
type McpSourceView = {
  drive: "mcp";
  level: "source";
  sourceId: string;
  label: string;
};
type ChatsView = { drive: "chats"; level: "drives" };
type ArcanasView = { drive: "arcanas"; level: "browse" };
type View =
  | DeviceView
  | DeviceSourceView
  | McpView
  | McpSourceView
  | ChatsView
  | ArcanasView;

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

export function QuotaMeter({
  quota,
  label,
}: {
  quota?: QuotaInfo | null;
  label: string;
}) {
  if (!quota || !(quota.quota > 0)) return null;
  const percent = (quota.usage / quota.quota) * 100;
  return (
    <div className="mt-1.5 min-w-0">
      <div className="h-1 overflow-hidden rounded-full bg-base-200">
        <div
          data-quota-bar
          className={`h-full rounded-full ${percent >= 90 ? "bg-warning" : "bg-accent"}`}
          style={{
            width: `${Math.min(100, Math.max(2, percent))}%`,
          }}
        />
      </div>
      <div className="mt-0.5 truncate text-[10px] text-base-content/50">
        {label}
      </div>
    </div>
  );
}

/**
 * Provider quotas shared by the drive rail and the browser pane: one quota per
 * source, plus the aggregated numbers each drive card shows.
 */
export function useSourceQuotas(sources: WorkspaceSourceRow[]) {
  const { providers } = useWorkspaceProviders(sources);
  const [quotas, setQuotas] = useState<Record<string, QuotaInfo | null>>({});

  const localSources = useMemo(
    () => sources.filter((source) => source.kind === "local"),
    [sources],
  );
  const mcpSources = useMemo(
    () => sources.filter((source) => source.kind === "mcp"),
    [sources],
  );
  const arcanaSources = useMemo(
    () =>
      sources.filter(
        (source) =>
          source.kind === "arcana-filesystem" || source.kind === "arcana",
      ),
    [sources],
  );
  const arcanaSource = arcanaSources[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    for (const provider of providers.values()) {
      if (provider.status !== "connected" || !provider.quota) continue;
      void (async () => {
        try {
          const quota = await provider.quota!();
          if (!cancelled) {
            setQuotas((current) => ({
              ...current,
              [provider.sourceId]: quota,
            }));
          }
        } catch {
          if (!cancelled) {
            setQuotas((current) => ({
              ...current,
              [provider.sourceId]: null,
            }));
          }
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [providers]);

  const deviceQuota = useMemo(() => {
    let usage = 0;
    let quota = 0;
    let reporting = 0;
    for (const source of localSources) {
      const value = quotas[source.id];
      if (!value || !(value.quota > 0)) continue;
      usage += value.usage;
      quota += value.quota;
      reporting += 1;
    }
    return reporting > 0
      ? ({ usage, quota, free: Math.max(0, quota - usage), scope: "origin" } as const)
      : null;
  }, [localSources, quotas]);

  const chatsQuota = useMemo(() => {
    const provider = Array.from(providers.values()).find(
      (item) => item.kind === "browser",
    );
    return provider ? (quotas[provider.sourceId] ?? null) : null;
  }, [providers, quotas]);

  const arcanasQuota = arcanaSource
    ? (quotas[arcanaSource.id] ?? null)
    : null;

  return {
    providers,
    quotas,
    localSources,
    mcpSources,
    arcanaSources,
    arcanaSource,
    deviceQuota,
    chatsQuota,
    arcanasQuota,
  };
}

export default function WorkspaceSourceBrowser({
  sources,
  target,
  onTargetChange,
  onAddToWorkspace,
  busy = false,
  onRemoveSource,
  onToggleSourceReadOnly,
  onAddDeviceFolder,
  isInWorkspace,
  embedded = false,
  className = "",
}: {
  sources: WorkspaceSourceRow[];
  target: SourceTarget | null;
  onTargetChange: (target: SourceTarget | null) => void;
  onAddToWorkspace: (selection: SourcesSelection[]) => Promise<void> | void;
  busy?: boolean;
  onRemoveSource?: (source: WorkspaceSourceRow) => void;
  onToggleSourceReadOnly?: (source: WorkspaceSourceRow) => void;
  onAddDeviceFolder?: () => void;
  isInWorkspace?: (selection: SourcesSelection) => boolean;
  embedded?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const conversations = (useConversationList() || []) as Conversation[];
  const { providers, quotas, localSources, mcpSources, arcanaSource } =
    useSourceQuotas(sources);
  const [view, setView] = useState<View | null>(null);
  const [path, setPath] = useState("/");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Map<string, SourcesSelection>>(
    new Map(),
  );
  const [adding, setAdding] = useState(false);

  const localById = useMemo(
    () => new Map(localSources.map((source) => [source.id, source])),
    [localSources],
  );
  const mcpById = useMemo(
    () => new Map(mcpSources.map((source) => [source.id, source])),
    [mcpSources],
  );
  const conversationTitle = useCallback(
    (conversation: Conversation) =>
      conversation.title?.trim() || t("workspace.source_browser.untitled_chat"),
    [t],
  );

  const latest = useRef({
    localById,
    mcpById,
    conversations,
    conversationTitle,
  });
  latest.current = { localById, mcpById, conversations, conversationTitle };

  const targetDrive = target?.drive ?? null;
  const targetSourceId =
    target && target.drive === "device" ? target.sourceId : undefined;

  useEffect(() => {
    setPath("/");
    setSelected(new Map());
    if (!targetDrive) {
      setView(null);
      return;
    }
    if (targetDrive === "device") {
      if (targetSourceId) {
        const source = latest.current.localById.get(targetSourceId);
        setView({
          drive: "device",
          level: "source",
          sourceId: targetSourceId,
          label: source?.label?.trim() || targetSourceId,
        });
        return;
      }
      setView({ drive: "device", level: "drives" });
      return;
    }
    if (targetDrive === "chats") {
      setView({ drive: "chats", level: "drives" });
      return;
    }
    if (targetDrive === "mcp") {
      setView({ drive: "mcp", level: "drives" });
      return;
    }
    setView({ drive: "arcanas", level: "browse" });
  }, [targetDrive, targetSourceId]);

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
        } else if (view.drive === "mcp" && view.level === "drives") {
          next = sortRows(
            mcpSources.map((source) => ({
              id: source.id,
              referenceId: source.id,
              name: source.label?.trim() || source.id,
              path: "/",
              kind: "dir" as const,
            })),
          );
        } else if (view.drive === "mcp") {
          const source = mcpById.get(view.sourceId);
          if (!source) throw new Error(t("workspace.source_browser.unavailable"));
          const provider = providers.get(source.id);
          if (!provider) return;
          next = await listProvider(provider, path);
        } else if (view.drive === "chats") {
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
    mcpSources,
    mcpById,
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
      if (view.drive === "mcp") {
        if (view.level === "drives") {
          const source = row.referenceId
            ? mcpById.get(row.referenceId)
            : undefined;
          if (!source) return null;
          return {
            sourceId: source.id,
            sourceKind: "mcp",
            path: "/",
            name: row.name,
            kind: "dir",
            title: row.name,
          };
        }
        return {
          sourceId: view.sourceId,
          sourceKind: "mcp",
          path: row.path,
          name: row.name,
          kind: row.kind,
          title: row.kind === "dir" ? row.name : undefined,
        };
      }
      if (view.drive === "chats") {
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
    [view, localById, mcpById, arcanaSource],
  );

  const visibleItems = useMemo(
    () =>
      rows
        .map((row) => {
          const selection = selectionFor(row);
          return selection
            ? {
                row,
                selection,
                inWorkspace: isInWorkspace?.(selection) ?? false,
              }
            : null;
        })
        .filter(
          (
            item,
          ): item is {
            row: Row;
            selection: SourcesSelection;
            inWorkspace: boolean;
          } => item !== null,
        ),
    [rows, selectionFor, isInWorkspace],
  );
  const selectableItems = visibleItems.filter((item) => !item.inWorkspace);
  const allVisibleSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) =>
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
        if (checked && item.inWorkspace) continue;
        const key = selectionKey(item.selection);
        if (checked) next.set(key, item.selection);
        else next.delete(key);
      }
      return next;
    });
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
    if (view.drive === "mcp" && view.level === "drives") {
      const source = row.referenceId
        ? mcpById.get(row.referenceId)
        : undefined;
      if (source) {
        setPath("/");
        setView({
          drive: "mcp",
          level: "source",
          sourceId: source.id,
          label: source.label?.trim() || source.id,
        });
      }
      return;
    }
    if (view.drive === "chats") {
      const selection = selectionFor(row);
      if (selection && isInWorkspace?.(selection)) return;
      if (selection) {
        toggleSelection(selection, !selected.has(selectionKey(selection)));
      }
      return;
    }
    if (row.kind === "dir") {
      setPath(row.path);
      return;
    }
    const selection = selectionFor(row);
    if (selection && isInWorkspace?.(selection)) return;
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
      onTargetChange(null);
      return;
    }
    if (view.drive === "mcp") {
      if (view.level === "source" && path !== "/") {
        setPath(parentPath(path));
        return;
      }
      if (view.level === "source") {
        setPath("/");
        setView({ drive: "mcp", level: "drives" });
        return;
      }
      onTargetChange(null);
      return;
    }
    if (view.drive === "chats") {
      onTargetChange(null);
      return;
    }
    if (path !== "/") {
      setPath(parentPath(path));
      return;
    }
    onTargetChange(null);
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
        : view.drive === "mcp"
          ? t("workspace.source_browser.mcp")
          : t("workspace.source_browser.arcanas")
    : "";
  const breadcrumb = view
    ? [
        (view.drive === "device" || view.drive === "mcp") &&
        view.level === "source"
          ? view.label
          : "",
        ...normalizePath(path).split("/").filter(Boolean),
      ]
        .filter(Boolean)
        .join(" / ") || "/"
    : "/";
  const pending = adding || busy;
  const usageLabel = (quota: QuotaInfo | null, shared = false) =>
    quota
      ? t(
          shared
            ? "workspace.source_browser.chat_usage"
            : "workspace.source_browser.usage",
          {
            used: formatBytes(quota.usage),
            quota: formatBytes(quota.quota),
          },
        )
      : "";

  const sectionClassName = embedded
    ? `flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${className}`
    : `flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 ${className}`;

  return (
    <section data-guide="workspace-source-browser" className={sectionClassName}>
      <div className="flex min-w-0 shrink-0 items-center gap-1 border-b border-base-300 px-2 py-1.5">
        {view && (
          <button
            type="button"
            onClick={goBack}
            aria-label={t("workspace.source_browser.back")}
            title={t("workspace.source_browser.back")}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/55 transition hover:bg-base-200 hover:text-base-content"
          >
            <ArrowLeft size={14} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold leading-tight text-base-content">
            {view ? driveName : t("workspace.source_browser.title")}
          </div>
          {view && (
            <div
              className="truncate text-[10px] leading-tight text-base-content/50"
              title={breadcrumb}
            >
              {breadcrumb}
            </div>
          )}
        </div>
        {view && visibleItems.length > 0 && (
          <input
            type="checkbox"
            className="checkbox checkbox-xs mr-0.5 shrink-0"
            checked={allVisibleSelected}
            onChange={(event) => toggleVisible(event.target.checked)}
            aria-label={t("workspace.source_browser.select_all")}
            title={t("workspace.source_browser.select_all")}
          />
        )}
        <button
          type="button"
          data-guide="workspace-add-to-workspace"
          onClick={() => void addSelection()}
          disabled={selected.size === 0 || pending}
          className="btn btn-primary btn-xs shrink-0 gap-1"
        >
          {pending && <span className="loading loading-spinner loading-xs" />}
          <span className="truncate">
            {selected.size > 0
              ? t("workspace.source_browser.add_to_workspace_count", {
                  count: selected.size,
                })
              : t("workspace.source_browser.add_to_workspace")}
          </span>
        </button>
      </div>

      {!view ? (
        <div
          data-guide="workspace-source-browser-hint"
          className="flex flex-1 items-center justify-center p-6 text-center text-[11px] text-base-content/50"
        >
          <span className="max-w-[24rem]">
            {t("workspace.source_browser.pick_source")}
          </span>
        </div>
      ) : (
        <>
          <div
            data-guide="workspace-source-browser-list"
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-1"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-[11px] text-base-content/50">
                <span className="loading loading-spinner loading-xs" />
                <span className="truncate">
                  {t("workspace.source_browser.loading")}
                </span>
              </div>
            ) : error ? (
              <div className="flex items-start gap-1.5 p-2 text-[11px] text-error">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">{error}</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 p-4 text-center text-[11px] text-base-content/50">
                <Folder size={18} className="text-base-content/30" />
                <span className="truncate">
                  {t("workspace.source_browser.empty")}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {visibleItems.map(({ row, selection, inWorkspace }) => {
                  const checked = selected.has(selectionKey(selection));
                  const inWorkspaceLabel = t(
                    "workspace.source_browser.in_workspace",
                  );
                  const source =
                    view.drive === "device" &&
                    view.level === "drives" &&
                    row.referenceId
                      ? localById.get(row.referenceId)
                      : undefined;
                  if (source) {
                    const quota = quotas[source.id] ?? null;
                    return (
                      <div
                        key={row.id}
                        className={`group flex min-w-0 items-start gap-1 rounded-xl border px-1.5 py-1.5 transition ${
                          checked
                            ? "border-accent/50 bg-accent/5"
                            : "border-base-300/60 hover:border-accent/40 hover:bg-base-200/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs mt-0.5 shrink-0"
                          checked={checked}
                          disabled={inWorkspace}
                          title={inWorkspace ? inWorkspaceLabel : undefined}
                          onChange={(event) => {
                            if (inWorkspace) return;
                            toggleSelection(selection, event.target.checked);
                          }}
                          aria-label={row.name}
                        />
                        <button
                          type="button"
                          onClick={() => openRow(row)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Folder
                              size={14}
                              className="shrink-0 text-accent"
                            />
                            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-base-content">
                              {row.name}
                            </span>
                            <span className="shrink-0 rounded bg-base-200 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-base-content/50">
                              {t("workspace.kind_" + source.kind)}
                            </span>
                          </span>
                          <QuotaMeter quota={quota} label={usageLabel(quota)} />
                        </button>
                        {inWorkspace && (
                          <span className="flex shrink-0 whitespace-nowrap items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-success">
                            <Check size={11} />
                            {inWorkspaceLabel}
                          </span>
                        )}
                        {(onToggleSourceReadOnly || onRemoveSource) && (
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
                  }
                  return (
                    <div
                      key={row.id}
                      className={`group flex min-w-0 items-center gap-1 rounded-lg border px-1 py-1 transition ${
                        checked
                          ? "border-accent/50 bg-accent/5"
                          : "border-transparent hover:bg-base-200/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs shrink-0"
                        checked={checked}
                        disabled={inWorkspace}
                        title={inWorkspace ? inWorkspaceLabel : undefined}
                        onChange={(event) => {
                          if (inWorkspace) return;
                          toggleSelection(selection, event.target.checked);
                        }}
                        aria-label={row.name}
                      />
                      <button
                        type="button"
                        onClick={() => openRow(row)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        {view.drive === "chats" ? (
                          <MessageSquare
                            size={14}
                            className="shrink-0 text-base-content/45"
                          />
                        ) : row.kind === "dir" ? (
                          <Folder size={14} className="shrink-0 text-accent" />
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
                        {row.kind === "dir" && view.drive !== "chats" && (
                          <ChevronRight
                            size={12}
                            className="shrink-0 text-base-content/30"
                          />
                        )}
                      </button>
                      {inWorkspace && (
                        <span className="flex shrink-0 whitespace-nowrap items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-success">
                          <Check size={11} />
                          {inWorkspaceLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {view.drive === "device" &&
            view.level === "drives" &&
            onAddDeviceFolder && (
              <div className="shrink-0 border-t border-base-300 px-1 py-1">
                <button
                  type="button"
                  data-guide="workspace-sources-add-device-folder"
                  onClick={onAddDeviceFolder}
                  className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-dashed border-base-300 px-2 py-1.5 text-left text-[11px] font-medium text-base-content/70 transition hover:border-accent/40 hover:bg-base-200/60"
                >
                  <Plus size={14} className="shrink-0" />
                  <span className="min-w-0 truncate">
                    {t("workspace.source_browser.add_device_folder")}
                  </span>
                </button>
              </div>
            )}

        </>
      )}
    </section>
  );
}
