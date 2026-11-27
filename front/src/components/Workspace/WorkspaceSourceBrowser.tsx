import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Locked, TrashCan, Unlocked } from "@carbon/icons-react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  Folder,
  HardDrive,
  MessageSquare,
  Plus,
  Users,
  X,
} from "lucide-react";

import { useConversationList } from "../../db";
import type {
  SourceKind,
  WorkspaceFileEntry,
  WorkspaceSourceRow,
} from "../../db/dbTypes";
import { baseName, parentPath } from "../../workspace/paths";
import type {
  FileProvider,
  QuotaInfo,
} from "../../workspace/providers/types";
import {
  ragCollectionDisplayName,
  type RagCollection,
  type RagMember,
  type RagMemberRole,
  type RagPrincipalKind,
  SaiaRagProvider,
} from "../../workspace/providers/saiaRag";
import { sourceProblem } from "../../workspace/sourceStatus";
import { useWorkspaceProviders } from "../../workspace/useWorkspaceProviders";
import { formatBytes } from "../../utils/formatBytes";
import Tooltip from "../Others/Tooltip";

export type SourcesSelection = {
  sourceId: string;
  sourceKind:
    | "local"
    | "chat"
    | "arcana-filesystem"
    | "arcana"
    | "mcp"
    | "saia-fs"
    | "saia-rag";
  path: string;
  name: string;
  kind: "dir" | "file";
  conversationId?: string;
  title?: string;
  readOnly?: boolean;
};

export type SourceTarget =
  | { drive: "device"; sourceId?: string }
  | { drive: "chats"; conversationId?: string }
  | { drive: "rag" }
  | { drive: "mcp" }
  | { drive: "saia-fs" };

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
// saia-rag is a list of collections plus one level of flat files, so a single
// browse level covers both: `/` lists collections, `/collection` its files.
type RagView = { drive: "rag"; level: "browse" };
// The SAIA filesystem is a single account folder, so there is no source list to
// choose from: the drive opens straight into that folder.
type SaiaFsView = { drive: "saia-fs"; level: "browse" };
type View =
  | DeviceView
  | DeviceSourceView
  | McpView
  | McpSourceView
  | ChatsView
  | RagView
  | SaiaFsView;

type Row = {
  id: string;
  name: string;
  path: string;
  kind: "dir" | "file";
  size?: number;
  referenceId?: string;
  readOnly?: boolean;
  /** Set on a collection row at the saia-rag root. */
  collection?: RagCollection;
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
      readOnly: entry.readOnly,
    })),
  );

async function listProvider(provider: FileProvider, path: string): Promise<Row[]> {
  const page = await provider.list(path || "/");
  return fromEntries(page.entries);
}

/** The provider under a read-only wrapper, for the extras it guards. */
const baseProvider = (provider: FileProvider): FileProvider =>
  "innerProvider" in provider
    ? ((provider as unknown as { innerProvider: FileProvider }).innerProvider)
    : provider;

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
  // Where the Arcana filesystem card used to be, the workspace now shows the
  // saia-rag collections. An existing workspace may still carry an
  // `arcana-filesystem` row (and its mounts) from before the switch; the row is
  // left alone, but the rail no longer offers a second document drive.
  const ragSources = useMemo(
    () => sources.filter((source) => source.kind === "saia-rag"),
    [sources],
  );
  const ragSource = ragSources[0] ?? null;
  // saia-fs reports no quota (the account folder's size is not exposed), so it
  // has a card without a meter.
  const saiaSource =
    sources.find((source) => source.kind === "saia-fs") ?? null;

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

  const ragQuota = ragSource ? (quotas[ragSource.id] ?? null) : null;

  return {
    providers,
    quotas,
    localSources,
    mcpSources,
    ragSources,
    ragSource,
    saiaSource,
    deviceQuota,
    chatsQuota,
    ragQuota,
  };
}

export default function WorkspaceSourceBrowser({
  sources,
  target,
  onTargetChange,
  onAddToWorkspace,
  onUnmountSelection,
  busy = false,
  onRemoveSource,
  onToggleSourceReadOnly,
  onAddDeviceFolder,
  onMountDeviceFolder,
  onPickDeviceFolder,
  isInWorkspace,
  isMounted,
  embedded = false,
  className = "",
}: {
  sources: WorkspaceSourceRow[];
  target: SourceTarget | null;
  onTargetChange: (target: SourceTarget | null) => void;
  onAddToWorkspace: (selection: SourcesSelection[]) => Promise<void> | void;
  onUnmountSelection?: (selection: SourcesSelection[]) => Promise<void> | void;
  busy?: boolean;
  onRemoveSource?: (source: WorkspaceSourceRow) => void;
  onToggleSourceReadOnly?: (source: WorkspaceSourceRow) => void;
  onAddDeviceFolder?: () => void;
  onMountDeviceFolder?: (handle: FileSystemDirectoryHandle) => Promise<void> | void;
  onPickDeviceFolder?: () => Promise<string | void> | string | void;
  isInWorkspace?: (selection: SourcesSelection) => boolean;
  /** Whether any workspace mounts this item; defaults to `isInWorkspace`. */
  isMounted?: (selection: SourcesSelection) => boolean;
  embedded?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  // `useConversationList` returns undefined until its first answer; a bare `|| []`
  // would hand the listing effect a new array on every render and restart it.
  const conversationRows = useConversationList();
  const conversations = useMemo(
    () => (conversationRows ?? []) as Conversation[],
    [conversationRows],
  );
  const { providers, quotas, localSources, mcpSources, ragSource, saiaSource } =
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
  const [unmounting, setUnmounting] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [dropError, setDropError] = useState("");
  // Collection management is inline, not a modal: the storage manager lives
  // inside the create-workspace dialog, and opening a second dialog there would
  // replace that draft.
  const [ragNewOpen, setRagNewOpen] = useState(false);
  const [ragNewName, setRagNewName] = useState("");
  const [ragBusy, setRagBusy] = useState(false);
  const [ragError, setRagError] = useState("");
  const [ragConfirmDelete, setRagConfirmDelete] = useState<string | null>(null);
  const [ragRevision, setRagRevision] = useState(0);
  const [membersFor, setMembersFor] = useState<{
    display: string;
    collection: RagCollection;
  } | null>(null);
  const [members, setMembers] = useState<RagMember[] | null>(null);
  const [membersError, setMembersError] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<RagMemberRole>("editor");
  const [memberKind, setMemberKind] = useState<RagPrincipalKind>("user");

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
    localSources,
    mcpSources,
    conversations,
    conversationTitle,
    ragSource,
    saiaSource,
  });
  latest.current = {
    localById,
    mcpById,
    localSources,
    mcpSources,
    conversations,
    conversationTitle,
    ragSource,
    saiaSource,
  };

  const targetDrive = target?.drive ?? null;
  const targetSourceId =
    target && target.drive === "device" ? target.sourceId : undefined;

  /**
   * The provider the open view lists through.
   *
   * A status write after every connect replaces the `sources` array and the
   * `providers` map, but the provider object itself stays the same. Depending on
   * that object (instead of the map) keeps the listing effect from restarting —
   * and re-sending `list_collections` — while a source is still connecting.
   */
  const viewProvider = useMemo(() => {
    if (!view) return null;
    if (view.drive === "device") {
      return view.level === "source"
        ? providers.get(view.sourceId) ?? null
        : null;
    }
    if (view.drive === "mcp") {
      return view.level === "drives"
        ? null
        : providers.get(view.sourceId) ?? null;
    }
    if (view.drive === "saia-fs") {
      return saiaSource ? providers.get(saiaSource.id) ?? null : null;
    }
    if (view.drive === "rag") {
      return ragSource ? providers.get(ragSource.id) ?? null : null;
    }
    return null;
  }, [view, providers, ragSource, saiaSource]);

  /**
   * What the rail and the tree show, without the fields a connect rewrites
   * (`status`, `error`, `capabilities`). Each of those writes a new `sources`
   * array; depending on the content keeps a status report from restarting the
   * listing.
   */
  const sourcesContentKey = useMemo(
    () =>
      sources
        .map((source) =>
          [
            source.id,
            source.kind,
            source.label ?? "",
            source.readOnly === true ? "ro" : "rw",
            JSON.stringify(source.config ?? {}),
          ].join("|"),
        )
        .join("\n"),
    [sources],
  );

  // Everything listed inside a read-only source is read-only too, so those
  // rows carry the same lock the workspace tree shows.
  const viewReadOnly = useMemo(() => {
    if (!view) return false;
    if (view.drive === "device") {
      return view.level === "source"
        ? localById.get(view.sourceId)?.readOnly === true
        : false;
    }
    if (view.drive === "mcp") {
      return view.level === "drives"
        ? false
        : mcpById.get(view.sourceId)?.readOnly === true;
    }
    if (view.drive === "saia-fs") return saiaSource?.readOnly === true;
    if (view.drive === "rag") return ragSource?.readOnly === true;
    return false;
  }, [view, localById, mcpById, ragSource, saiaSource]);

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
    if (targetDrive === "saia-fs") {
      setView({ drive: "saia-fs", level: "browse" });
      return;
    }
    setView({ drive: "rag", level: "browse" });
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
            latest.current.localSources.map((source) => ({
              id: source.id,
              referenceId: source.id,
              name: source.label?.trim() || source.id,
              path: "/",
              kind: "dir" as const,
            })),
          );
        } else if (view.drive === "device") {
          const source = latest.current.localById.get(view.sourceId);
          if (!source) throw new Error(t("workspace.source_browser.unavailable"));
          if (!viewProvider) return;
          next = await listProvider(viewProvider, path);
        } else if (view.drive === "mcp" && view.level === "drives") {
          next = sortRows(
            latest.current.mcpSources.map((source) => ({
              id: source.id,
              referenceId: source.id,
              name: source.label?.trim() || source.id,
              path: "/",
              kind: "dir" as const,
            })),
          );
        } else if (view.drive === "mcp") {
          const source = latest.current.mcpById.get(view.sourceId);
          if (!source) throw new Error(t("workspace.source_browser.unavailable"));
          if (!viewProvider) return;
          next = await listProvider(viewProvider, path);
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
        } else if (view.drive === "saia-fs") {
          if (!latest.current.saiaSource)
            throw new Error(t("workspace.source_browser.unavailable"));
          if (!viewProvider) return;
          next = await listProvider(viewProvider, path);
        } else if (view.drive === "rag") {
          if (!latest.current.ragSource)
            throw new Error(t("workspace.source_browser.unavailable"));
          if (!viewProvider) return;
          if (path === "/") {
            // Collections carry the caller's role, which the rows show and the
            // owner-only actions need, so the metadata comes from the provider's
            // own list rather than from a plain directory listing.
            const rag = baseProvider(viewProvider) as unknown as SaiaRagProvider;
            const collections = await rag.listCollections();
            next = sortRows(
              collections.map((collection) => {
                const display = ragCollectionDisplayName(collection);
                return {
                  id: collection.collection,
                  name: display,
                  path: `/${display}`,
                  kind: "dir" as const,
                  readOnly: !collection.can_write,
                  collection,
                };
              }),
            );
          } else {
            next = await listProvider(viewProvider, path);
          }
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
    viewProvider,
    sourcesContentKey,
    conversations,
    conversationTitle,
    ragRevision,
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
      if (view.drive === "saia-fs") {
        if (!saiaSource) return null;
        return {
          sourceId: saiaSource.id,
          sourceKind: "saia-fs",
          path: row.path,
          name: row.name,
          kind: row.kind,
          title: row.kind === "dir" ? row.name : undefined,
          readOnly: saiaSource.readOnly === true,
        };
      }
      if (view.drive === "rag") {
        if (!ragSource) return null;
        return {
          sourceId: ragSource.id,
          sourceKind: "saia-rag",
          path: row.path,
          name: row.name,
          kind: row.kind,
          title: row.kind === "dir" ? row.name : undefined,
          readOnly:
            ragSource.readOnly === true ||
            row.readOnly === true ||
            row.collection?.can_write === false,
        };
      }
      return null;
    },
    [view, localById, mcpById, ragSource, saiaSource],
  );

  // The folder that is open right now. An empty folder has no row to select, so
  // this is what the empty state offers: mounting the folder itself, roots
  // included. A saia-fs account starts out empty and would otherwise be
  // impossible to add to a workspace.
  const currentFolder = useMemo((): SourcesSelection | null => {
    if (!view) return null;
    if (view.drive === "chats") return null;
    if (view.drive === "device" && view.level === "drives") return null;
    if (view.drive === "mcp" && view.level === "drives") return null;
    if (view.drive === "device" || view.drive === "mcp") {
      const source =
        view.drive === "device"
          ? localById.get(view.sourceId)
          : mcpById.get(view.sourceId);
      if (!source) return null;
      const name =
        path === "/" ? source.label?.trim() || source.id : baseName(path);
      return {
        sourceId: source.id,
        sourceKind: view.drive === "device" ? "local" : "mcp",
        path,
        name,
        kind: "dir",
        title: name,
      };
    }
    if (view.drive === "saia-fs") {
      if (!saiaSource) return null;
      const name =
        path === "/" ? t("workspace.source_browser.saia_fs") : baseName(path);
      return {
        sourceId: saiaSource.id,
        sourceKind: "saia-fs",
        path,
        name,
        kind: "dir",
        title: name,
        readOnly: saiaSource.readOnly === true,
      };
    }
    if (view.drive === "rag") {
      // The collection list is not a folder that can be mounted; each collection
      // is. Inside a collection, its own read-only role travels with the mount.
      if (!ragSource || path === "/") return null;
      const name = baseName(path);
      const provider = providers.get(ragSource.id);
      const collection = provider
        ? (baseProvider(provider) as unknown as Partial<SaiaRagProvider>)
            .collectionFor?.(name)
        : undefined;
      return {
        sourceId: ragSource.id,
        sourceKind: "saia-rag",
        path,
        name,
        kind: "dir",
        title: name,
        readOnly:
          ragSource.readOnly === true || collection?.can_write === false,
      };
    }
    return null;
  }, [view, path, localById, mcpById, ragSource, providers, saiaSource, t]);

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
  const toggleSelection = (selection: SourcesSelection, checked: boolean) => {
    setSelected((current) => {
      const next = new Map(current);
      const key = selectionKey(selection);
      if (checked) next.set(key, selection);
      else next.delete(key);
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

  // A row can be selected whether or not it is mounted already: the Add button
  // takes the ones outside the workspace, Unmount takes the mounted ones.
  const selectedList = useMemo(() => Array.from(selected.values()), [selected]);
  const addableSelected = useMemo(
    () => selectedList.filter((item) => !(isInWorkspace?.(item) ?? false)),
    [selectedList, isInWorkspace],
  );
  const mountedSelected = useMemo(() => {
    const mounted = isMounted ?? isInWorkspace;
    return selectedList.filter((item) => mounted?.(item) ?? false);
  }, [selectedList, isMounted, isInWorkspace]);
  const forget = (items: SourcesSelection[]) =>
    setSelected((current) => {
      const next = new Map(current);
      for (const item of items) next.delete(selectionKey(item));
      return next;
    });

  const addSelection = async () => {
    if (addableSelected.length === 0 || adding || busy) return;
    setAdding(true);
    try {
      await onAddToWorkspace(addableSelected);
      forget(addableSelected);
    } catch {
      return;
    } finally {
      setAdding(false);
    }
  };

  const currentFolderInWorkspace =
    currentFolder !== null && (isInWorkspace?.(currentFolder) ?? false);

  const addCurrentFolder = async () => {
    if (!currentFolder || currentFolderInWorkspace || adding || busy) return;
    setAdding(true);
    try {
      await onAddToWorkspace([currentFolder]);
    } catch {
      return;
    } finally {
      setAdding(false);
    }
  };

  // With nothing ticked, the toolbar offers the folder that is open instead of
  // a dead button: an empty folder has nothing to select, and a full one can
  // still be mounted as a whole.
  const offersCurrentFolder = selectedList.length === 0 && currentFolder !== null;
  const addableCurrentFolder = offersCurrentFolder && !currentFolderInWorkspace;

  const unmountSelection = async () => {
    if (!onUnmountSelection || mountedSelected.length === 0 || unmounting || busy) {
      return;
    }
    setUnmounting(true);
    try {
      await onUnmountSelection(mountedSelected);
      forget(mountedSelected);
    } finally {
      setUnmounting(false);
    }
  };

  // ---- saia-rag collections ------------------------------------------------
  //
  // Collections are created, deleted and shared here rather than through the
  // tree: a collection is not a folder, and these actions belong to the drive
  // rail. The panel is inline on purpose — the storage manager lives inside the
  // create-workspace dialog, so a second dialog would replace that draft.
  const ragProvider = useCallback((): SaiaRagProvider | null => {
    if (!ragSource) return null;
    const provider = providers.get(ragSource.id);
    if (!provider) return null;
    return baseProvider(provider) as unknown as SaiaRagProvider;
  }, [providers, ragSource]);

  const ragAtRoot = view?.drive === "rag" && path === "/";

  const refreshCollections = () => setRagRevision((value) => value + 1);

  const createCollection = async () => {
    const provider = ragProvider();
    const name = ragNewName.trim();
    if (!provider || !name || ragBusy) return;
    setRagBusy(true);
    setRagError("");
    try {
      await provider.createCollection(name);
      setRagNewName("");
      setRagNewOpen(false);
      refreshCollections();
    } catch (reason) {
      setRagError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRagBusy(false);
    }
  };

  const deleteCollection = async (collection: RagCollection) => {
    const provider = ragProvider();
    if (!provider || ragBusy) return;
    setRagBusy(true);
    setRagError("");
    setRagConfirmDelete(null);
    try {
      await provider.deleteCollection(ragCollectionDisplayName(collection));
      if (membersFor?.display === ragCollectionDisplayName(collection)) {
        setMembersFor(null);
        setMembers(null);
      }
      refreshCollections();
    } catch (reason) {
      setRagError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRagBusy(false);
    }
  };

  const openMembers = async (collection: RagCollection) => {
    const provider = ragProvider();
    const display = ragCollectionDisplayName(collection);
    setMembersFor({ display, collection });
    setMembers(null);
    setMembersError("");
    setMemberName("");
    setMemberRole("editor");
    setMemberKind("user");
    if (!provider) {
      setMembersError(t("workspace.source_browser.unavailable"));
      return;
    }
    try {
      setMembers(await provider.listMembers(display));
    } catch (reason) {
      setMembersError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const closeMembers = () => {
    setMembersFor(null);
    setMembers(null);
    setMembersError("");
    setMemberName("");
  };

  const addMember = async () => {
    const provider = ragProvider();
    const name = memberName.trim();
    if (!provider || !membersFor || !name || ragBusy) return;
    setRagBusy(true);
    setMembersError("");
    try {
      await provider.addMember(
        membersFor.display,
        name,
        memberRole,
        memberKind,
      );
      setMemberName("");
      setMembers(await provider.listMembers(membersFor.display));
      refreshCollections();
    } catch (reason) {
      setMembersError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRagBusy(false);
    }
  };

  const removeMember = async (member: RagMember) => {
    const provider = ragProvider();
    if (!provider || !membersFor || ragBusy) return;
    setRagBusy(true);
    setMembersError("");
    try {
      await provider.removeMember(membersFor.display, member.user);
      setMembers(await provider.listMembers(membersFor.display));
      refreshCollections();
    } catch (reason) {
      setMembersError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRagBusy(false);
    }
  };

  const driveName = view
    ? view.drive === "device"
      ? t("workspace.source_browser.device")
      : view.drive === "chats"
        ? t("workspace.source_browser.chats")
        : view.drive === "mcp"
          ? t("workspace.source_browser.mcp")
          : view.drive === "saia-fs"
            ? t("workspace.source_browser.saia_fs")
            : t("workspace.source_browser.rag")
    : "";
  const pending = adding || unmounting || busy;
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

  const deviceRoot = view?.drive === "device" && view.level === "drives";
  const deviceEmpty =
    deviceRoot && !loading && !error && rows.length === 0;

  // The same pills the workspace tree shows, so a folder reads "device" here and in the tree.
  const badgeForSource = useCallback(
    (source?: WorkspaceSourceRow) => {
      switch (source?.kind) {
        case "local":
          return t("workspace.storage_badge_device");
        case "arcana":
        case "arcana-filesystem":
          return t("workspace.storage_badge_arcana");
        case "mcp":
          return t("workspace.storage_badge_mcp");
        case "saia-fs":
          return t("workspace.storage_badge_saia");
        case "saia-rag":
          return t("workspace.storage_badge_rag");
        case "agent":
          return t("workspace.storage_badge_agent");
        default:
          return t("workspace.storage_badge_browser");
      }
    },
    [t],
  );

  const badgeForEntry = useCallback(
    () => {
      if (view?.drive === "chats") return t("workspace.storage_badge_browser");
      if (view?.drive === "mcp") return t("workspace.storage_badge_mcp");
      if (view?.drive === "rag") return t("workspace.storage_badge_rag");
      if (view?.drive === "saia-fs")
        return t("workspace.storage_badge_saia");
      const source =
        view && view.level === "source"
          ? localById.get(view.sourceId)
          : undefined;
      return source
        ? badgeForSource(source)
        : t("workspace.storage_badge_device");
    },
    [badgeForSource, localById, t, view],
  );

  // A dropped folder arrives as a FileSystemDirectoryHandle in Chromium; anything else (a file, or
  // a browser without getAsFileSystemHandle) cannot be mounted and says so.
  const dropFolder = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDropActive(false);
      setDropError("");
      for (const item of Array.from(event.dataTransfer?.items ?? [])) {
        const pick = (
          item as DataTransferItem & {
            getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
          }
        ).getAsFileSystemHandle;
        if (item.kind !== "file" || typeof pick !== "function") continue;
        try {
          const handle = await pick.call(item);
          if (handle && handle.kind === "directory" && onMountDeviceFolder) {
            await onMountDeviceFolder(handle as FileSystemDirectoryHandle);
            return;
          }
        } catch {
          break;
        }
      }
      setDropError(t("workspace.source_browser.device_drop_rejected"));
    },
    [onMountDeviceFolder, t],
  );

  const openFolderPicker = async () => {
    setDropError("");
    const message = onPickDeviceFolder
      ? await onPickDeviceFolder()
      : onAddDeviceFolder?.();
    if (message) setDropError(message);
  };

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
        </div>
        {onUnmountSelection && (
          <button
            type="button"
            data-guide="workspace-unmount"
            onClick={() => void unmountSelection()}
            disabled={mountedSelected.length === 0 || pending}
            title={t("workspace.source_browser.unmount_hint")}
            className="btn btn-secondary btn-xs shrink-0 gap-1"
          >
            {unmounting && (
              <span className="loading loading-spinner loading-xs" />
            )}
            <span className="truncate">
              {mountedSelected.length > 0
                ? t("workspace.source_browser.unmount_count", {
                    count: mountedSelected.length,
                  })
                : t("workspace.source_browser.unmount")}
            </span>
          </button>
        )}
        <button
          type="button"
          data-guide="workspace-add-to-workspace"
          onClick={() =>
            void (offersCurrentFolder ? addCurrentFolder() : addSelection())
          }
          disabled={
            (offersCurrentFolder
              ? !addableCurrentFolder
              : addableSelected.length === 0) || pending
          }
          className="btn btn-primary btn-xs shrink-0 gap-1"
        >
          {adding && <span className="loading loading-spinner loading-xs" />}
          <span className="truncate">
            {addableSelected.length > 0
              ? t("workspace.source_browser.add_to_workspace_count", {
                  count: addableSelected.length,
                })
              : offersCurrentFolder
                ? t("workspace.source_browser.add_current_dir")
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
            {membersFor ? (
              <div
                className="flex flex-col gap-2 p-1"
                data-guide="workspace-rag-members"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold text-base-content">
                      {t("workspace.source_browser.rag_members_title", {
                        name: membersFor.collection.name,
                      })}
                    </div>
                    <div className="text-[10px] leading-snug text-base-content/50">
                      {t("workspace.source_browser.rag_members_hint")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeMembers}
                    title={t("workspace.source_browser.rag_members_close")}
                    aria-label={t("workspace.source_browser.rag_members_close")}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/40 transition hover:bg-base-200 hover:text-base-content"
                  >
                    <X size={13} />
                  </button>
                </div>

                {members === null && !membersError ? (
                  <div className="flex items-center gap-2 p-2 text-[11px] text-base-content/50">
                    <span className="loading loading-spinner loading-xs" />
                    <span>{t("workspace.source_browser.loading")}</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {(members ?? []).map((member) => (
                      <div
                        key={`${member.kind}:${member.user}`}
                        className="flex min-w-0 items-center gap-1 rounded-lg border border-base-300/60 px-1.5 py-1"
                      >
                        <span className="min-w-0 flex-1 truncate text-[11px] text-base-content">
                          {member.user}
                        </span>
                        <span className="shrink-0 rounded-full border border-base-300 px-1.5 py-px text-[9px] font-medium tracking-wide text-base-content/55">
                          {t(
                            `workspace.source_browser.rag_role_${member.role}`,
                          )}
                        </span>
                        <span className="shrink-0 rounded-full border border-base-300 px-1.5 py-px text-[9px] font-medium tracking-wide text-base-content/55">
                          {member.kind === "group"
                            ? t("workspace.source_browser.rag_kind_group")
                            : t("workspace.source_browser.rag_kind_user")}
                        </span>
                        {member.role !== "owner" && (
                          <button
                            type="button"
                            onClick={() => void removeMember(member)}
                            disabled={ragBusy}
                            title={t(
                              "workspace.source_browser.rag_remove_member",
                            )}
                            aria-label={t(
                              "workspace.source_browser.rag_remove_member",
                            )}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/40 transition hover:bg-error/10 hover:text-error"
                          >
                            <TrashCan size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    {(members ?? []).length === 0 && (
                      <p className="px-1 py-1 text-[10px] text-base-content/45">
                        {t("workspace.source_browser.rag_members_empty")}
                      </p>
                    )}
                  </div>
                )}

                {membersError && (
                  <div className="flex items-start gap-1.5 text-[10px] text-error">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span className="min-w-0 break-words">{membersError}</span>
                  </div>
                )}

                <div className="mt-1 flex flex-col gap-1 border-t border-base-300 pt-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-base-content/50">
                    {t("workspace.source_browser.rag_add_member")}
                  </div>
                  <input
                    className="input input-xs w-full"
                    value={memberName}
                    placeholder={t(
                      "workspace.source_browser.rag_member_placeholder",
                    )}
                    onChange={(event) => setMemberName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void addMember();
                      }
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <select
                      className="select select-xs min-w-0 flex-1"
                      value={memberKind}
                      onChange={(event) =>
                        setMemberKind(event.target.value as RagPrincipalKind)
                      }
                      aria-label={t(
                        "workspace.source_browser.rag_member_kind",
                      )}
                    >
                      <option value="user">
                        {t("workspace.source_browser.rag_kind_user")}
                      </option>
                      <option value="group">
                        {t("workspace.source_browser.rag_kind_group")}
                      </option>
                    </select>
                    <select
                      className="select select-xs min-w-0 flex-1"
                      value={memberRole}
                      onChange={(event) =>
                        setMemberRole(event.target.value as RagMemberRole)
                      }
                      aria-label={t(
                        "workspace.source_browser.rag_member_role",
                      )}
                    >
                      <option value="editor">
                        {t("workspace.source_browser.rag_role_editor")}
                      </option>
                      <option value="reader">
                        {t("workspace.source_browser.rag_role_reader")}
                      </option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void addMember()}
                      disabled={!memberName.trim() || ragBusy}
                      className="btn btn-primary btn-xs shrink-0"
                    >
                      {ragBusy && (
                        <span className="loading loading-spinner loading-xs" />
                      )}
                      {t("workspace.source_browser.rag_add_member_action")}
                    </button>
                  </div>
                </div>
              </div>
            ) : loading ? (
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
            ) : deviceEmpty ? (
              <div className="flex h-full min-h-[10rem] items-stretch p-1">
                <div
                  data-guide="workspace-device-empty"
                  role="button"
                  tabIndex={0}
                  aria-label={t("workspace.source_browser.device_empty_body")}
                  onClick={openFolderPicker}
                  onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openFolderPicker();
                    }
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDropActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropActive(true);
                  }}
                  onDragLeave={() => setDropActive(false)}
                  onDrop={dropFolder}
                  className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-5 py-8 text-center transition ${
                    dropActive
                      ? "border-accent bg-accent/10"
                      : "border-base-300 hover:border-accent/50 hover:bg-base-200/40"
                  }`}
                >
                  <HardDrive
                    size={42}
                    strokeWidth={1.25}
                    className="text-base-content/20"
                  />
                  <p className="max-w-[22rem] text-sm font-semibold text-base-content/70">
                    {t("workspace.source_browser.device_empty_title")}
                  </p>
                  <p className="max-w-[24rem] text-[11px] leading-relaxed text-base-content/45">
                    {t("workspace.source_browser.device_empty_body")}
                  </p>
                  {dropError && (
                    <p className="max-w-[24rem] text-[10px] text-error">
                      {dropError}
                    </p>
                  )}
                </div>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 p-4 text-center text-[11px] text-base-content/50">
                <Folder size={18} className="text-base-content/30" />
                <span className="truncate">
                  {ragAtRoot
                    ? t("workspace.source_browser.rag_empty")
                    : t("workspace.source_browser.empty")}
                </span>
                {currentFolder &&
                  (currentFolderInWorkspace ? (
                    <span className="mt-0.5 flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-success">
                      <Check size={11} />
                      {t("workspace.source_browser.in_workspace")}
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        data-guide="workspace-add-current-folder"
                        onClick={() => void addCurrentFolder()}
                        disabled={pending}
                        className="btn btn-primary btn-xs mt-0.5 gap-1"
                      >
                        {adding && (
                          <span className="loading loading-spinner loading-xs" />
                        )}
                        <Plus size={12} />
                        <span className="truncate">
                          {t("workspace.source_browser.add_current_folder")}
                        </span>
                      </button>
                      <span className="max-w-[22rem] text-[10px] leading-relaxed text-base-content/40">
                        {t("workspace.source_browser.empty_folder_hint")}
                      </span>
                    </>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {visibleItems.map(({ row, selection, inWorkspace }) => {
                  const checked = selected.has(selectionKey(selection));
                  const ragCollection =
                    view.drive === "rag" ? row.collection : undefined;
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
                    const problem = sourceProblem(source, t);
                    const readOnlyLabel = t("workspace.mount_read_only");
                    return (
                      <div
                        key={row.id}
                        className={`group flex min-w-0 items-start gap-1.5 rounded-xl border px-1.5 py-1.5 transition ${
                          checked
                            ? "border-accent/50 bg-accent/5"
                            : "border-base-300/60 hover:border-accent/40 hover:bg-base-200/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs mr-0.5 mt-0.5 shrink-0"
                          checked={checked}
                          title={
                            inWorkspace
                              ? t("workspace.source_browser.unmount_hint")
                              : undefined
                          }
                          onChange={(event) => {
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
                            {problem && (
                              <Tooltip
                                text={problem}
                                placement="right"
                                interactive
                                width="max-w-[17rem]"
                                className="shrink-0"
                              >
                                <span
                                  role="img"
                                  aria-label={problem}
                                  title={problem}
                                  data-guide="workspace-source-broken"
                                  className="flex items-center"
                                >
                                  <AlertCircle
                                    size={13}
                                    className="text-error"
                                  />
                                </span>
                              </Tooltip>
                            )}
                            {source.readOnly && (
                              <span
                                className="shrink-0 text-warning"
                                title={readOnlyLabel}
                                aria-label={readOnlyLabel}
                                data-guide="workspace-source-lock"
                              >
                                <Locked size={11} />
                              </span>
                            )}
                            <span className="shrink-0 rounded-full border border-base-300 px-1.5 py-px text-[9px] font-medium tracking-wide text-base-content/55">
                              {badgeForSource(source)}
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
                      className={`group flex min-w-0 items-center gap-1.5 rounded-lg border px-1 py-1 transition ${
                        checked
                          ? "border-accent/50 bg-accent/5"
                          : "border-transparent hover:bg-base-200/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs mr-0.5 shrink-0"
                        checked={checked}
                        title={
                          inWorkspace
                            ? t("workspace.source_browser.unmount_hint")
                            : undefined
                        }
                        onChange={(event) => {
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
                        {ragCollection &&
                          ["owner", "editor", "reader"].includes(
                            ragCollection.role,
                          ) && (
                            <span
                              className="shrink-0 rounded-full border border-base-300 px-1.5 py-px text-[9px] font-medium tracking-wide text-base-content/55"
                              title={t(
                                `workspace.source_browser.rag_role_${ragCollection.role}`,
                              )}
                            >
                              {t(
                                `workspace.source_browser.rag_role_${ragCollection.role}`,
                              )}
                            </span>
                          )}
                        {(viewReadOnly || row.readOnly) && (
                          <span
                            className="shrink-0 text-warning"
                            title={t("workspace.mount_read_only")}
                            aria-label={t("workspace.mount_read_only")}
                          >
                            <Locked size={11} />
                          </span>
                        )}
                        <span className="shrink-0 rounded-full border border-base-300 px-1.5 py-px text-[9px] font-medium tracking-wide text-base-content/55">
                          {badgeForEntry()}
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
                      {ragCollection && ragCollection.can_manage && (
                        <span className="flex shrink-0 items-center gap-0.5">
                          {ragConfirmDelete === ragCollection.collection ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void deleteCollection(ragCollection)
                                }
                                disabled={ragBusy}
                                title={t(
                                  "workspace.source_browser.rag_delete_confirm",
                                )}
                                aria-label={t(
                                  "workspace.source_browser.rag_delete_confirm",
                                )}
                                className="flex h-5 items-center gap-0.5 rounded px-1 text-[9px] font-semibold uppercase text-error transition hover:bg-error/10"
                              >
                                <TrashCan size={12} />
                                {t("common.delete")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setRagConfirmDelete(null)}
                                title={t("common.cancel")}
                                aria-label={t("common.cancel")}
                                className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 transition hover:bg-base-200 hover:text-base-content"
                              >
                                <X size={12} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void openMembers(ragCollection);
                                }}
                                title={t(
                                  "workspace.source_browser.rag_manage_members",
                                )}
                                aria-label={t(
                                  "workspace.source_browser.rag_manage_members",
                                )}
                                className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-base-200 hover:text-base-content focus-visible:opacity-100 group-hover:opacity-100"
                              >
                                <Users size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setRagError("");
                                  setRagConfirmDelete(
                                    ragCollection.collection,
                                  );
                                }}
                                title={t("common.delete")}
                                aria-label={t("common.delete")}
                                className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-error/10 hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
                              >
                                <TrashCan size={12} />
                              </button>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {ragAtRoot && !membersFor && (
            <div className="shrink-0 border-t border-base-300 px-1 py-1">
              {ragError && (
                <div className="flex items-start gap-1.5 px-1 pb-1 text-[10px] text-error">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 break-words">{ragError}</span>
                </div>
              )}
              {ragNewOpen ? (
                <div className="flex flex-col gap-1">
                  <input
                    className="input input-xs w-full"
                    autoFocus
                    value={ragNewName}
                    placeholder={t(
                      "workspace.source_browser.rag_new_collection_placeholder",
                    )}
                    onChange={(event) => setRagNewName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void createCollection();
                      }
                      if (event.key === "Escape") {
                        setRagNewOpen(false);
                        setRagNewName("");
                      }
                    }}
                  />
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => {
                        setRagNewOpen(false);
                        setRagNewName("");
                      }}
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      disabled={!ragNewName.trim() || ragBusy}
                      onClick={() => void createCollection()}
                    >
                      {ragBusy && (
                        <span className="loading loading-spinner loading-xs" />
                      )}
                      {t("workspace.source_browser.rag_create")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  data-guide="workspace-rag-new-collection"
                  onClick={() => {
                    setRagError("");
                    setRagNewOpen(true);
                  }}
                  disabled={ragSource?.readOnly === true}
                  className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-dashed border-base-300 px-2 py-1.5 text-left text-[11px] font-medium text-base-content/70 transition hover:border-accent/40 hover:bg-base-200/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={14} className="shrink-0" />
                  <span className="min-w-0 truncate">
                    {t("workspace.source_browser.rag_new_collection")}
                  </span>
                </button>
              )}
            </div>
          )}

          {deviceRoot && !deviceEmpty && onAddDeviceFolder && (
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
