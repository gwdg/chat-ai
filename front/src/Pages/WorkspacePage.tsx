import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import {
  Add,
  Bot,
  ChevronRight,
  Download,
  Edit,
  Folder,
  FolderAdd,
  Home,
  Locked,
  Unlocked,
  TrashCan,
  Upload,
  WarningAltFilled,
} from "@carbon/icons-react";

import Header from "../components/Header/Header";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import WorkspaceRootTree from "../components/Workspace/WorkspaceRootTree";
import WorkspaceRootBrowser from "../components/Workspace/WorkspaceRootBrowser";
import WorkspaceFilePanel from "../components/Workspace/WorkspaceFilePanel";
import { useModal } from "../modals/ModalContext";
import { useToast } from "../hooks/useToast";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { formatBytes } from "../utils/formatBytes";
import { formatGitLog } from "../utils/gitLog";
import { useConversationList } from "../db";
import { useAgents } from "../agents/agentStore";
import {
  deleteWorkspace,
  detachWorkspaceChat,
  getDeviceId,
  removeSource,
  removeWorkspaceMount,
  updateSource,
  saveTransfer,
  setWorkspaceMountReadOnly,
  usePendingTransfers,
  useWorkspace,
  useWorkspaceChats,
  useWorkspaceMounts,
  useWorkspaceSources,
  useWorkspaceAgents,
  detachWorkspaceAgent,
  removeOrphanWorkspaceAgents,
} from "../db/workspaceDb";
import type { WorkspaceFileEntry, WorkspaceMountRow } from "../db/dbTypes";
import { DEVICE_PLANE_KINDS } from "../workspace/deviceId";
import {
  createWorkspaceRootProvider,
  emptyStream,
  workspaceRootSourceId,
} from "../workspace/workspaceRoot";
import type { RootEntry } from "../workspace/workspaceRoot";
import { useWorkspaceProviders } from "../workspace/useWorkspaceProviders";
import { planTransfer } from "../workspace/transferPlanner";
import { runTransfer } from "../workspace/transfer";
import { uploadLocalFiles } from "../workspace/upload";
import { baseName, joinPath, normalizePath, parentPath } from "../workspace/paths";
import type { FileProvider, QuotaInfo } from "../workspace/providers/types";

const readAll = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
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
  for (const part of chunks) {
    data.set(part, offset);
    offset += part.length;
  }
  return data;
};

const PREVIEW_LIMIT = 8 * 1024 * 1024;

const readProviderText = async (provider: FileProvider, path: string) => {
  const bytes = await readAll(await provider.read(path));
  return new TextDecoder().decode(bytes);
};

const readGitLog = async (provider: FileProvider, gitPath: string) => {
  try {
    return formatGitLog(
      await readProviderText(provider, joinPath(gitPath, "logs/HEAD")),
    );
  } catch {
    const head = (
      await readProviderText(provider, joinPath(gitPath, "HEAD"))
    ).trim();
    const branch = head.replace(/^ref:\s*/, "");
    if (!branch) throw new Error("No Git history found.");
    return formatGitLog(
      await readProviderText(provider, joinPath(gitPath, `logs/${branch}`)),
    );
  }
};



const isTextFile = (entry: WorkspaceFileEntry): boolean => {
  const name = entry.name.toLowerCase();
  return (
    entry.mime?.startsWith("text/") === true ||
    entry.mime?.includes("json") === true ||
    entry.mime?.includes("xml") === true ||
    /\.(md|txt|csv|tsv|json|xml|ya?ml|html?|css|jsx?|tsx?|py|sh|toml|ini|log|typ|tex)$/.test(
      name,
    )
  );
};

const quotaLabel = (
  kind: string,
  quota: QuotaInfo | null | undefined,
): { label: string; percent: number | null } => {
  if (kind === "local" || kind === "mcp") {
    return { label: "—", percent: null };
  }
  if (!quota || (!quota.quota && !quota.usage)) {
    return { label: "—", percent: null };
  }
  const percent = quota.quota ? Math.round((quota.usage / quota.quota) * 100) : null;
  if (kind === "browser") {
    return {
      label: `${formatBytes(quota.usage)} of ${formatBytes(quota.quota)} used — shared with this app`,
      percent,
    };
  }
  return {
    label: `${formatBytes(quota.usage)} of ${formatBytes(quota.quota)} used`,
    percent,
  };
};

export default function WorkspacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const { openModal, confirmAction } = useModal();
  const { notifyError, notifySuccess } = useToast();
  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();

  const workspace = useWorkspace(workspaceId);
  const sources = useWorkspaceSources(workspaceId);
  const mounts = useWorkspaceMounts(workspaceId);
  const workspaceChats = useWorkspaceChats(workspaceId);
  const conversations = useConversationList() || [];
  const attachedChats = useMemo(
    () =>
      workspaceChats
        .map((link) =>
          conversations.find((conversation) => conversation.id === link.conversationId),
        )
        .filter(Boolean),
    [workspaceChats, conversations],
  );
  const agents = useAgents();
  const workspaceAgents = useWorkspaceAgents(workspaceId);
  const attachedAgents = useMemo(
    () =>
      workspaceAgents
        .map((link) => agents.find((agent) => agent.id === link.agentId))
        .filter(Boolean),
    [workspaceAgents, agents],
  );
  useEffect(() => {
    void removeOrphanWorkspaceAgents(agents.map((agent) => agent.id));
  }, [agents]);
  const pendingTransfers = usePendingTransfers(workspaceId);
  const resumedRef = useRef<Set<string>>(new Set());
  const { providers, reconnect } = useWorkspaceProviders(sources);
  const rootProvider = useMemo(
    () => (workspaceId ? createWorkspaceRootProvider(workspaceId) : null),
    [workspaceId],
  );
  const [rootPath, setRootPath] = useState("/");
  const [rootEntries, setRootEntries] = useState<RootEntry[]>([]);
  const [rootTreeEntries, setRootTreeEntries] = useState<RootEntry[]>([]);
  const [rootTreeRevision, setRootTreeRevision] = useState(0);
  const [rootLoading, setRootLoading] = useState(false);
  const [rootError, setRootError] = useState("");

  const sidebarState = useMemo(
    () => ({ id: "", title: "", messages: [], folderId: null, settings: { model: "" } }),
    [],
  );

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [activeMountId, setActiveMountId] = useState<string | null>(null);
  const activeMount = mounts.find((mount) => mount.id === activeMountId);
  const [pathBySource, setPathBySource] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<WorkspaceFileEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [preview, setPreview] = useState<{
    entry: WorkspaceFileEntry;
    text?: string;
    url?: string;
    error?: string;
    loading: boolean;
    onOpenPath?: (path: string) => void;
  } | null>(null);
  const [quotas, setQuotas] = useState<Record<string, QuotaInfo | null>>({});
  const [transferring, setTransferring] = useState(false);
  const [draggingEntry, setDraggingEntry] = useState<{
    sourceId: string;
    entry: WorkspaceFileEntry;
  } | null>(null);
  const [dragHint, setDragHint] = useState<"copy" | "move" | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const selectedSource = sources.find((source) => source.id === selectedSourceId);
  const selectedProvider = selectedSourceId
    ? providers.get(selectedSourceId)
    : undefined;
  const currentPath = selectedSourceId
    ? pathBySource[selectedSourceId] ?? "/"
    : "/";
  const rootSourceId = workspaceId ? workspaceRootSourceId(workspaceId) : "";
  const providerFor = (sourceId: string) =>
    sourceId === rootSourceId ? rootProvider : providers.get(sourceId);

  useEffect(() => {
    if (
      selectedSourceId &&
      !sources.some((source) => source.id === selectedSourceId)
    ) {
      setSelectedSourceId(null);
    }
  }, [sources, selectedSourceId]);

  useEffect(() => {
    if (activeMountId && !mounts.some((mount) => mount.id === activeMountId)) {
      setActiveMountId(null);
    }
  }, [mounts, activeMountId]);

  const refreshQuota = useCallback(async (provider: FileProvider) => {
    if (!provider.quota) return;
    try {
      const quota = await provider.quota();
      setQuotas((current) => ({ ...current, [provider.sourceId]: quota }));
    } catch {
      setQuotas((current) => ({ ...current, [provider.sourceId]: null }));
    }
  }, []);

  useEffect(() => {
    for (const provider of providers.values()) {
      if (provider.status === "connected") void refreshQuota(provider);
    }
  }, [providers, refreshQuota]);

  useEffect(() => {
    if (!workspaceId || providers.size === 0) return;
    for (const job of pendingTransfers) {
      if (resumedRef.current.has(job.id)) continue;
      if (job.status !== "running" && job.status !== "queued") continue;
      const from = providers.get(job.fromSourceId);
      const to = providers.get(job.toSourceId);
      if (!from || !to) {
        resumedRef.current.add(job.id);
        void saveTransfer({ ...job, status: "cancelled" });
        continue;
      }
      resumedRef.current.add(job.id);
      void (async () => {
        try {
          if (from.status !== "connected") await from.connect();
          if (to.status !== "connected") await to.connect();
          const entry = await from.stat(job.fromPath);
          await saveTransfer({ ...job, status: "cancelled" });
          await runTransfer({
            workspaceId,
            from,
            to,
            entry,
            targetDir: job.toPath,
            strategy: job.intent,
          });
          void refreshQuota(from);
          void refreshQuota(to);
        } catch (error) {
          notifyError(error instanceof Error ? error.message : String(error));
        }
      })();
    }
  }, [providers, pendingTransfers, workspaceId, refreshQuota, notifyError]);

  const loadEntries = useCallback(
    async (append = false) => {
      if (!selectedProvider) {
        setEntries([]);
        setNextCursor(undefined);
        return;
      }
      setLoading(true);
      setListError("");
      try {
        if (selectedProvider.status !== "connected") {
          await selectedProvider.connect();
        }
        const page = await selectedProvider.list(
          currentPath,
          append ? nextCursor : undefined,
        );
        setEntries((current) => (append ? [...current, ...page.entries] : page.entries));
        setNextCursor(page.next);
        void refreshQuota(selectedProvider);
      } catch (error) {
        setListError(error instanceof Error ? error.message : String(error));
        if (!append) setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedProvider, currentPath, nextCursor, refreshQuota],
  );

  useEffect(() => {
    void loadEntries(false);
  }, [selectedSourceId, currentPath, selectedProvider]);

  const listRoot = useCallback(
    async (path: string): Promise<RootEntry[]> => {
      if (!rootProvider || !workspaceId) return [];
      await rootProvider.connect();
      const page = await rootProvider.list(path);
      const local: RootEntry[] = page.entries.map((entry) => ({
        ...entry,
        local: true,
      }));
      const prefix = path === "/" ? "/" : `${path}/`;
      const virtual = new Map<string, RootEntry>();
      for (const mount of mounts) {
        const mountPath = normalizePath(mount.path);
        if (mountPath === path || !mountPath.startsWith(prefix)) continue;
        const rest = mountPath.slice(prefix.length);
        const first = rest.split("/")[0];
        if (!first || local.some((entry) => entry.name === first)) continue;
        const entryPath = joinPath(path, first);
        if (virtual.has(first)) continue;
        virtual.set(first, {
          sourceId: workspaceRootSourceId(workspaceId),
          path: entryPath,
          name: first,
          kind: "dir",
          local: false,
          mount: mountPath === entryPath ? mount : undefined,
        });
      }
      return [...local, ...virtual.values()];
    },
    [rootProvider, workspaceId, mounts],
  );

  const loadRoot = useCallback(async () => {
    if (!rootProvider) {
      setRootEntries([]);
      return;
    }
    setRootLoading(true);
    setRootError("");
    try {
      setRootEntries(await listRoot(rootPath));
    } catch (error) {
      setRootError(error instanceof Error ? error.message : String(error));
      setRootEntries([]);
    } finally {
      setRootLoading(false);
    }
  }, [rootProvider, rootPath, listRoot]);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot]);

  const loadRootTree = useCallback(async () => {
    try {
      setRootTreeEntries(await listRoot("/"));
    } catch {
      setRootTreeEntries([]);
    }
  }, [listRoot]);

  useEffect(() => {
    void loadRootTree();
  }, [loadRootTree]);

  const createRootEntry = (kind: "dir" | "file") => {
    openModal("workspaceCreateEntry", {
      kind,
      path: rootPath,
      onCreate: async (name: string) => {
        if (!rootProvider) return;
        await rootProvider.connect();
        const path = joinPath(rootPath, name);
        if (kind === "dir") {
          await rootProvider.mkdir(path);
        } else {
          await rootProvider.write(path, emptyStream(), { overwrite: false });
        }
        await loadRoot();
      },
    });
  };

  const closePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
  }, []);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const clearDeletedPreview = (path: string) => {
    if (!preview) return;
    const deleted = normalizePath(path);
    const open = normalizePath(preview.entry.path);
    if (open === deleted || open.startsWith(`${deleted}/`)) closePreview();
  };

  const deleteRootEntry = async (entry: RootEntry) => {
    if (!rootProvider || !entry.local || entry.mount) return;
    const deleted = normalizePath(entry.path);
    const browsingDeleted =
      rootPath === deleted || rootPath.startsWith(`${deleted}/`);
    try {
      await rootProvider.connect();
      await rootProvider.remove(entry.path, { recursive: true });
      clearDeletedPreview(entry.path);
      if (browsingDeleted) setRootPath(parentPath(entry.path));
      await loadRootTree();
      if (!browsingDeleted) await loadRoot();
      setRootTreeRevision((current) => current + 1);
      notifySuccess(t("workspace.delete_success", { name: entry.name }));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    }
  };

  const deleteSourceEntry = async (entry: WorkspaceFileEntry) => {
    if (!selectedProvider) return;
    const deleted = normalizePath(entry.path);
    const browsingDeleted =
      currentPath === deleted || currentPath.startsWith(`${deleted}/`);
    try {
      if (selectedProvider.status !== "connected") {
        await selectedProvider.connect();
      }
      await selectedProvider.remove(entry.path, { recursive: true });
      clearDeletedPreview(entry.path);
      if (browsingDeleted) {
        setPathBySource((current) => ({
          ...current,
          [selectedSourceId!]: parentPath(entry.path),
        }));
      } else {
        await loadEntries(false);
      }
      void refreshQuota(selectedProvider);
      notifySuccess(t("workspace.delete_success", { name: entry.name }));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    }
  };

  const requestDeleteEntry = (
    entry: WorkspaceFileEntry,
    onConfirm: () => void,
  ) =>
    confirmAction(
      {
        warningKey: "warn_workspace_file_delete",
        messageKey:
          entry.kind === "dir"
            ? "workspace.delete_folder_confirm"
            : "workspace.delete_file_confirm",
        confirmKey: "common.delete",
        danger: true,
      },
      onConfirm,
    );

  const requestDeleteRootEntry = (entry: RootEntry) =>
    requestDeleteEntry(entry, () => void deleteRootEntry(entry));

  const requestDeleteSourceEntry = (entry: WorkspaceFileEntry) =>
    requestDeleteEntry(entry, () => void deleteSourceEntry(entry));

  const canDeleteSourceEntry = (entry: WorkspaceFileEntry) =>
    selectedProvider?.capabilities?.delete === true &&
    selectedSource?.readOnly !== true &&
    activeMount?.readOnly !== true &&
    !(selectedProvider.kind === "arcana-filesystem" && entry.kind === "dir");

  const downloadEntry = async (
    entry: WorkspaceFileEntry,
    provider = selectedProvider,
  ) => {
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

  const renameEntry = (
    entry: WorkspaceFileEntry,
    provider = selectedProvider,
    after: () => Promise<void> | void = loadEntries,
  ) => {
    if (!provider) return;
    const parent = parentPath(entry.path);
    openModal("workspaceCreateEntry", {
      kind: entry.kind,
      path: parent || "/",
      initialName: entry.name,
      titleKey: "workspace.rename_entry",
      confirmKey: "common.rename",
      onCreate: async (name: string) => {
        if (name === entry.name) return;
        if (provider.status !== "connected") await provider.connect();
        await provider.move(entry.path, joinPath(parent, name));
        await after();
        notifySuccess(t("workspace.rename_success", { name }));
      },
    });
  };

  const createSourceEntry = (kind: "dir" | "file") => {
    if (!selectedProvider || !selectedSourceId) return;
    openModal("workspaceCreateEntry", {
      kind,
      path: currentPath,
      onCreate: async (name: string) => {
        if (selectedProvider.status !== "connected") {
          await selectedProvider.connect();
        }
        const path = joinPath(currentPath, name);
        if (kind === "dir") {
          await selectedProvider.mkdir(path);
        } else {
          await selectedProvider.write(path, emptyStream(), {
            overwrite: false,
          });
        }
        await loadEntries(false);
      },
    });
  };

  const openFile = async (
    entry: WorkspaceFileEntry,
    provider = selectedProvider,
  ) => {
    if (!provider) return;
    if (entry.kind === "dir") {
      setPathBySource((current) => ({
        ...current,
        [selectedSourceId!]: normalizePath(entry.path),
      }));
      return;
    }
    closePreview();
    setPreview({ entry, loading: true });
    try {
      if ((entry.size ?? 0) > PREVIEW_LIMIT) {
        setPreview({
          entry,
          loading: false,
          error: t("workspace.preview_too_large"),
        });
        return;
      }
      if (isTextFile(entry)) {
        const bytes = await readAll(await provider.read(entry.path));
        setPreview({
          entry,
          loading: false,
          text: new TextDecoder().decode(bytes),
        });
        return;
      }
      const bytes = await readAll(await provider.read(entry.path));
      const blob = new Blob([bytes], { type: entry.mime || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreview({ entry, loading: false, url });
    } catch (error) {
      setPreview({
        entry,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const openRootEntry = (entry: RootEntry) => {
    if (entry.mount) {
      openMount(entry.mount);
      return;
    }
    if (entry.kind === "dir") {
      setRootPath(entry.path);
      return;
    }
    void openFile(entry, rootProvider);
  };

  const gitProviderFor = (entry: RootEntry) => {
    if (entry.mount) {
      return {
        provider: providers.get(entry.mount.sourceId),
        basePath: entry.mount.sourcePath,
      };
    }
    return { provider: rootProvider, basePath: entry.path };
  };

  const checkRootGit = useCallback(
    async (entry: RootEntry) => {
      const { provider, basePath } = gitProviderFor(entry);
      if (!provider) return false;
      if (provider.status !== "connected") await provider.connect();
      const page = await provider.list(basePath);
      return page.entries.some(
        (child) => child.kind === "dir" && child.name === ".git",
      );
    },
    [providers, rootProvider],
  );

  const showRootGitLog = async (entry: RootEntry) => {
    const { provider, basePath } = gitProviderFor(entry);
    if (!provider) return;
    const gitPath = joinPath(basePath, ".git");
    const previewEntry = {
      ...entry,
      name: `${entry.name} · ${t("workspace.git_log")}`,
      path: gitPath,
      kind: "file" as const,
    };
    const openGitFile = (relativePath: string) => {
      const relative = String(relativePath).replace(/^\.\/+/, "");
      const path = joinPath(basePath, relative);
      void openFile(
        {
          sourceId: entry.sourceId,
          path,
          name: baseName(relative) || relative,
          kind: "file",
        },
        provider,
      );
    };
    closePreview();
    setPreview({ entry: previewEntry, loading: true });
    try {
      if (provider.status !== "connected") await provider.connect();
      const text = await readGitLog(provider, gitPath);
      setPreview({
        entry: previewEntry,
        loading: false,
        text: text || t("workspace.git_log_empty"),
        onOpenPath: openGitFile,
      });
    } catch (error) {
      setPreview({
        entry: previewEntry,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        onOpenPath: openGitFile,
      });
    }
  };

  const rootEntryReadOnly = (entry: RootEntry) => {
    if (!entry.mount) return false;
    const source = sources.find((candidate) => candidate.id === entry.mount!.sourceId);
    return entry.mount.readOnly === true || source?.readOnly === true;
  };

  const rootEntrySourceReadOnly = (entry: RootEntry) => {
    if (!entry.mount) return false;
    const source = sources.find((candidate) => candidate.id === entry.mount!.sourceId);
    return source?.readOnly === true;
  };

  const removeRootMount = (entry: RootEntry) => {
    if (entry.mount) removeMount(entry.mount.id);
  };

  const toggleRootMountReadOnly = (entry: RootEntry) => {
    if (entry.mount) toggleMountReadOnly(entry.mount);
  };

  const rootEntrySourceLabel = (entry: RootEntry) => {
    if (!entry.mount) return undefined;
    const source = sources.find(
      (candidate) => candidate.id === entry.mount!.sourceId,
    );
    return source?.label ?? entry.mount.sourceId;
  };

  const renderRootEntryActions = (entry: RootEntry) => {
    if (entry.local) {
      return (
        <>
          <button
            type="button"
            onClick={() =>
              renameEntry(entry, rootProvider ?? undefined, async () => {
                await loadRoot();
                await loadRootTree();
                setRootTreeRevision((current) => current + 1);
              })
            }
            className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-base-200 hover:text-base-content group-hover:opacity-100"
            title={t("common.rename")}
            aria-label={t("common.rename")}
          >
            <Edit size={12} />
          </button>
          {entry.kind === "file" && (
            <button
              type="button"
              onClick={() => void downloadEntry(entry, rootProvider ?? undefined)}
              className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-base-200 hover:text-base-content group-hover:opacity-100"
              title={t("workspace.download")}
              aria-label={t("workspace.download")}
            >
              <Download size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => requestDeleteRootEntry(entry)}
            className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-error/10 hover:text-error group-hover:opacity-100"
            title={t("common.delete")}
            aria-label={t("common.delete")}
          >
            <TrashCan size={12} />
          </button>
        </>
      );
    }
    if (!entry.mount) return null;
    const source = sources.find(
      (candidate) => candidate.id === entry.mount!.sourceId,
    );
    const sourceReadOnly = source?.readOnly === true;
    const effectiveReadOnly =
      entry.mount.readOnly === true || sourceReadOnly;
    return (
      <>
        <button
          type="button"
          onClick={() => !sourceReadOnly && toggleRootMountReadOnly(entry)}
          disabled={sourceReadOnly}
          className={`flex h-5 w-5 items-center justify-center rounded text-base-content/40 transition ${
            sourceReadOnly
              ? "cursor-default text-warning"
              : "opacity-0 hover:bg-base-200 hover:text-base-content group-hover:opacity-100"
          }`}
          title={
            sourceReadOnly
              ? t("workspace.source_read_only")
              : entry.mount.readOnly
                ? t("workspace.make_writable")
                : t("workspace.make_read_only")
          }
          aria-label={
            sourceReadOnly
              ? t("workspace.source_read_only")
              : entry.mount.readOnly
                ? t("workspace.make_writable")
                : t("workspace.make_read_only")
          }
        >
          {effectiveReadOnly ? <Locked size={12} /> : <Unlocked size={12} />}
        </button>
        <button
          type="button"
          onClick={() => removeRootMount(entry)}
          className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-error/10 hover:text-error group-hover:opacity-100"
          title={t("workspace.remove_mount")}
          aria-label={t("workspace.remove_mount")}
        >
          <TrashCan size={12} />
        </button>
      </>
    );
  };

  const download = (entry: WorkspaceFileEntry) => {
    if (!preview?.url) return;
    const link = document.createElement("a");
    link.href = preview.url;
    link.download = entry.name;
    link.click();
  };

  const uploadReadOnly = selectedSourceId
    ? activeMount?.readOnly === true ||
      selectedSource?.readOnly === true ||
      selectedProvider?.capabilities?.write !== true
    : false;
  const uploadDisabled =
    uploading ||
    uploadReadOnly ||
    (selectedSourceId ? !selectedProvider : !rootProvider);

  const triggerUpload = () => {
    if (uploadReadOnly) {
      notifyError(
        t(
          selectedSourceId
            ? "workspace.source_read_only_error"
            : "workspace.mount_read_only_error",
        ),
      );
      return;
    }
    uploadInputRef.current?.click();
  };

  const uploadFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const provider = selectedSourceId ? selectedProvider : rootProvider;
    const directory = selectedSourceId ? currentPath : rootPath;
    if (!provider || provider.capabilities?.write !== true) {
      notifyError(t("workspace.upload_not_supported"));
      return;
    }
    if (selectedSourceId && (activeMount?.readOnly || selectedSource?.readOnly)) {
      notifyError(t("workspace.source_read_only_error"));
      return;
    }
    setUploading(true);
    try {
      if (provider.status !== "connected") await provider.connect();
      const uploaded = await uploadLocalFiles(
        provider,
        directory,
        files,
        (file, error) => {
          notifyError(
            `${file.name}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        },
      );
      if (uploaded > 0) {
        notifySuccess(t("workspace.upload_success", { count: uploaded }));
      }
      if (selectedSourceId) await loadEntries(false);
      else await loadRoot();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setUploading(false);
    }
  };

  const addSource = () => {
    openModal("workspaceAddSource", {
      workspaceId,
      onAdded: () => setSelectedSourceId(null),
    });
  };

  const addFolder = (sourceId?: string) => {
    openModal("workspaceAddMount", {
      workspaceId,
      sources,
      mounts,
      initialSourceId: sourceId,
      onAdded: () => setSelectedSourceId(null),
    });
  };

  const openMount = (mount: { id: string; sourceId: string; sourcePath: string }) => {
    setActiveMountId(mount.id);
    setSelectedSourceId(mount.sourceId);
    setPathBySource((current) => ({
      ...current,
      [mount.sourceId]: normalizePath(mount.sourcePath),
    }));
  };

  const removeMount = (mountId: string) => {
    void removeWorkspaceMount(workspaceId!, mountId);
  };

  const toggleMountReadOnly = (mount: WorkspaceMountRow) => {
    void setWorkspaceMountReadOnly(mount.id, !mount.readOnly);
  };

  const attachChat = () => {
    openModal("workspaceAttachChat", {
      workspaceId,
      conversations,
      attachedIds: workspaceChats.map((link) => link.conversationId),
    });
  };

  const detachChat = (conversationId: string) => {
    void detachWorkspaceChat(workspaceId!, conversationId);
  };

  const attachAgent = () => {
    openModal("workspaceAttachAgent", {
      workspaceId,
      agents,
      attachedIds: workspaceAgents.map((link) => link.agentId),
    });
  };

  const detachAgent = (agentId: string) => {
    void detachWorkspaceAgent(workspaceId!, agentId);
  };

  const toggleSourceReadOnly = (source: { id: string; readOnly?: boolean }) => {
    void updateSource(source.id, { readOnly: !source.readOnly });
  };

  const removeSelectedSource = (sourceId: string, label: string) => {
    confirmAction(
      {
        warningKey: "warn_workspace_delete",
        messageKey: "workspace.remove_source_confirm",
        confirmKey: "workspace.remove_source",
        danger: true,
      },
      async () => {
        try {
          if (selectedSourceId === sourceId) {
            setSelectedSourceId(null);
            closePreview();
          }
          await removeSource(sourceId);
        } catch (error) {
          notifyError(error instanceof Error ? error.message : String(error));
        }
      },
    );
  };

  const deleteCurrentWorkspace = () => {
    if (!workspace) return;
    confirmAction(
      {
        warningKey: "warn_workspace_delete",
        messageKey: "workspace.delete_confirm",
        confirmKey: "workspace.delete_workspace",
        danger: true,
      },
      async () => {
        try {
          await deleteWorkspace(workspace.id);
          navigate("/");
        } catch (error) {
          notifyError(error instanceof Error ? error.message : String(error));
        }
      },
    );
  };

  const executeTransfer = async ({
    fromSourceId,
    toSourceId,
    entry,
    targetDir,
    strategy,
  }: {
    fromSourceId: string;
    toSourceId: string;
    entry: WorkspaceFileEntry;
    targetDir: string;
    strategy: "copy" | "move";
  }) => {
    const from = providerFor(fromSourceId);
    const to = providerFor(toSourceId);
    if (!from || !to) return;
    setTransferring(true);
    try {
      if (from.status !== "connected") await from.connect();
      if (to.status !== "connected") await to.connect();
      await runTransfer({
        workspaceId: workspaceId!,
        from,
        to,
        entry,
        targetDir,
        strategy,
      });
      if (from.sourceId === selectedSourceId) await loadEntries(false);
      if (to.sourceId === selectedSourceId) await loadEntries(false);
      if (from.sourceId === rootSourceId || to.sourceId === rootSourceId) {
        await loadRoot();
      }
      void refreshQuota(from);
      void refreshQuota(to);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransferring(false);
    }
  };

  const requestTransfer = ({
    fromSourceId,
    toSourceId,
    entry,
    targetDir,
    intent = "auto",
  }: {
    fromSourceId: string;
    toSourceId: string;
    entry: WorkspaceFileEntry;
    targetDir: string;
    intent?: "auto" | "move" | "copy";
  }) => {
    const from = providerFor(fromSourceId);
    const to = providerFor(toSourceId);
    if (!from || !to) return;
    if ((entry as { mount?: unknown }).mount) {
      notifyError(t("workspace.cannot_move_mount"));
      return;
    }
    const sameSource = fromSourceId === toSourceId;
    if (
      sameSource &&
      entry.kind === "file" &&
      parentPath(entry.path) === normalizePath(targetDir)
    ) {
      return;
    }
    const plan = planTransfer({
      intent,
      sameSource,
      sourceKind: from.kind,
      targetKind: to.kind,
      entries: [entry],
      sourcePath: entry.path,
      targetPath: joinPath(targetDir, entry.name),
      sourceCapabilities: from.capabilities,
      targetCapabilities: to.capabilities,
      freeBytes: quotas[toSourceId]?.free,
    });
    if (plan.blocked) {
      notifyError(plan.warnings[0] || t("workspace.transfer_blocked"));
      return;
    }
    if (
      activeMount?.readOnly &&
      fromSourceId === selectedSourceId &&
      plan.strategy === "move"
    ) {
      notifyError(t("workspace.mount_read_only_error"));
      return;
    }
    const fromSourceRow = sources.find((source) => source.id === fromSourceId);
    const toSourceRow = sources.find((source) => source.id === toSourceId);
    if (toSourceRow?.readOnly) {
      notifyError(t("workspace.source_read_only_error"));
      return;
    }
    if (fromSourceRow?.readOnly && plan.strategy === "move") {
      notifyError(t("workspace.source_read_only_error"));
      return;
    }
    const labelFor = (sourceId: string) =>
      sourceId === rootSourceId
        ? t("workspace.workspace_root")
        : (sources.find((source) => source.id === sourceId)?.label ?? "");
    const fromLabel = labelFor(fromSourceId);
    const toLabel = labelFor(toSourceId);
    if (plan.requiresConfirmation) {
      openModal("workspaceTransfer", {
        plan,
        fromLabel,
        toLabel,
        onConfirm: () =>
          executeTransfer({
            fromSourceId,
            toSourceId,
            entry,
            targetDir,
            strategy: plan.strategy,
          }),
      });
      return;
    }
    void executeTransfer({
      fromSourceId,
      toSourceId,
      entry,
      targetDir,
      strategy: plan.strategy,
    });
  };

  const onDrop = (
    event: React.DragEvent,
    toSourceId: string,
    targetDir: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (transferring) return;
    const raw = event.dataTransfer.getData("application/x-chat-ai-workspace");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      requestTransfer({
        fromSourceId: payload.sourceId,
        toSourceId,
        entry: payload.entry,
        targetDir,
      });
    } catch {
      // ignore malformed drag data
    }
  };

  const breadcrumbs = useMemo(() => {
    const parts = normalizePath(currentPath).split("/").filter(Boolean);
    const items = [{ label: t("workspace.root"), path: "/" }];
    let path = "/";
    for (const part of parts) {
      path = joinPath(path, part);
      items.push({ label: part, path });
    }
    return items;
  }, [currentPath, t]);

  const rootBreadcrumbs = useMemo(() => {
    const parts = normalizePath(rootPath).split("/").filter(Boolean);
    const items = [{ label: t("workspace.root"), path: "/" }];
    let path = "/";
    for (const part of parts) {
      path = joinPath(path, part);
      items.push({ label: part, path });
    }
    return items;
  }, [rootPath, t]);

  return (
    <div className="h-dvh grid grid-rows-[auto_1fr]">
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={uploadFiles}
      />
      <div className="min-w-0 overflow-hidden">
        <Header
          className="md:hidden"
          localState={sidebarState}
          setLocalState={() => {}}
          modelsData={modelsData}
          userData={userData}
        />
      </div>
      <div className="grid grid-cols-1 grid-rows-[1fr_auto] md:grid-cols-[auto_1fr] md:grid-rows-[1fr_auto] md:gap-x-2 gap-y-1 md:pt-1 bg-base-200 overflow-hidden">
        <SidebarWrapper
          localState={sidebarState}
          setLocalState={() => {}}
          userData={userData}
          modelsData={modelsData}
        />
        <div className="flex min-h-0 min-w-0 flex-col">
          {!workspace ? (
            <div className="flex flex-1 items-center justify-center text-sm text-base-content/60">
              {t("workspace.not_found")}
            </div>
          ) : (
            <>
              <header className="mx-auto mb-2 flex w-full items-start gap-3 rounded-xl border border-base-300 bg-base-100 px-3 py-2 shadow-sm md:max-w-[85vw] xl:max-w-[1300px]">
                <Bot size={18} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-base-content">
                    {workspace.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-base-content/60">
                    {t("workspace.subtitle")}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square text-base-content/60 hover:text-error"
                  onClick={deleteCurrentWorkspace}
                  title={t("workspace.delete_workspace")}
                  aria-label={t("workspace.delete_workspace")}
                >
                  <TrashCan size={16} />
                </button>
              </header>

              <div className="mx-auto flex min-h-0 w-full flex-1 gap-2 md:max-w-[85vw] xl:max-w-[1300px]">
                <aside
                  data-guide="workspace-sources"
                  className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100"
                >
                  <div className="flex items-center justify-between border-b border-base-300 px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
                      {t("workspace.available_storage")}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={addSource}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-base-content/50 transition hover:bg-base-200 hover:text-accent"
                        title={t("workspace.add_source")}
                        aria-label={t("workspace.add_source")}
                      >
                        <Add size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[45%] overflow-y-auto p-1.5">
                    {sources.length === 0 ? (
                      <button
                        type="button"
                        onClick={addSource}
                        className="flex w-full flex-col items-start gap-1 rounded-lg border border-dashed border-base-300 px-3 py-2 text-left text-xs text-base-content/60 transition hover:border-accent/40 hover:bg-base-200/60"
                      >
                        {t("workspace.no_sources")}
                      </button>
                    ) : (
                      sources.map((source) => {
                        const active = source.id === selectedSourceId;
                        const provider = providers.get(source.id);
                        const unavailable =
                          !!source.deviceId && source.deviceId !== getDeviceId();
                        const quota = quotas[source.id];
                        const storage = quotaLabel(source.kind, quota);
                        const isDevicePlane = DEVICE_PLANE_KINDS.has(source.kind);
                        return (
                          <div
                            key={source.id}
                            onDragOver={(event) => {
                              event.preventDefault();
                              if (!draggingEntry || unavailable) return;
                              setDragHint("move");
                            }}
                            onDragLeave={() => setDragHint(null)}
                            onDragEnd={() => setDragHint(null)}
                            onDrop={(event) => {
                              if (unavailable) return;
                              setDragHint(null);
                              if (source.readOnly) {
                                notifyError(t("workspace.source_read_only_error"));
                                return;
                              }
                              onDrop(event, source.id, "/");
                            }}
                            onClick={() => {
                              setActiveMountId(null);
                              setSelectedSourceId(source.id);
                            }}
                            className={`mb-1 cursor-pointer rounded-lg border px-2 py-1.5 transition ${
                              active
                                ? "border-accent/40 bg-accent/10"
                                : "border-transparent hover:bg-base-200"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMountId(null);
                                  setSelectedSourceId(source.id);
                                }}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <span className="truncate text-xs font-medium text-base-content">
                                  {source.label}
                                </span>
                                <span className="badge badge-ghost badge-xs capitalize">
                                  {t(`workspace.kind_${source.kind}`)}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  addFolder(source.id);
                                }}
                                className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 transition hover:bg-base-200 hover:text-accent"
                                title={t("workspace.add_folder")}
                                aria-label={t("workspace.add_folder")}
                              >
                                <FolderAdd size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleSourceReadOnly(source);
                                }}
                                className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 transition hover:bg-base-200 hover:text-base-content"
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
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeSelectedSource(source.id, source.label);
                                }}
                                className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 transition hover:bg-error/10 hover:text-error"
                                aria-label={t("workspace.remove_source")}
                                title={t("workspace.remove_source")}
                              >
                                <TrashCan size={12} />
                              </button>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {isDevicePlane && (
                                <span className="badge badge-warning badge-xs">
                                  {t("workspace.device_only")}
                                </span>
                              )}
                              {source.readOnly && (
                                <span className="badge badge-warning badge-xs">
                                  {t("workspace.source_read_only")}
                                </span>
                              )}
                              {unavailable && (
                                <span className="badge badge-error badge-xs">
                                  {t("workspace.unavailable_on_device")}
                                </span>
                              )}
                              {source.status === "needs-permission" && (
                                <button
                                  type="button"
                                  className="badge badge-warning badge-xs cursor-pointer"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    reconnect(source.id);
                                  }}
                                >
                                  {t("workspace.reconnect")}
                                </button>
                              )}
                              {source.status === "error" && (
                                <button
                                  type="button"
                                  className="badge badge-error badge-xs cursor-pointer"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    reconnect(source.id);
                                  }}
                                  title={source.error}
                                >
                                  {t("workspace.retry")}
                                </button>
                              )}
                            </div>
                            <div className="mt-1">
                              <div className="h-1 overflow-hidden rounded-full bg-base-200">
                                <div
                                  className={`h-full rounded-full ${
                                    storage.percent !== null && storage.percent >= 90
                                      ? "bg-warning"
                                      : "bg-accent"
                                  }`}
                                  style={{
                                    width: `${Math.min(100, Math.max(2, storage.percent ?? 0))}%`,
                                  }}
                                />
                              </div>
                              <p className="mt-0.5 truncate text-[10px] text-base-content/50">
                                {storage.label}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="border-t border-base-300 p-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
                        {t("workspace.workspace_root")}
                      </span>
                      <button
                        type="button"
                        onClick={() => addFolder()}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-base-content/50 transition hover:bg-base-200 hover:text-accent"
                        title={t("workspace.add_folder")}
                        aria-label={t("workspace.add_folder")}
                      >
                        <FolderAdd size={15} />
                      </button>
                    </div>
                    <div className="mt-1 max-h-44 overflow-y-auto">
                      {rootTreeEntries.length === 0 ? (
                        <p className="px-1 py-1 text-[10px] text-base-content/50">
                          {t("workspace.empty_folder")}
                        </p>
                      ) : (
                        <WorkspaceRootTree
                          key={rootTreeRevision}
                          entries={rootTreeEntries}
                          loadChildren={listRoot}
                          onOpen={openRootEntry}
                          onShowGitLog={(entry) => void showRootGitLog(entry)}
                          checkGit={checkRootGit}
                          onRemoveLocal={requestDeleteRootEntry}
                          onRemoveMount={removeRootMount}
                          onToggleMountReadOnly={toggleRootMountReadOnly}
                          isReadOnly={rootEntryReadOnly}
                          isSourceReadOnly={rootEntrySourceReadOnly}
                          sourceLabel={(entry) =>
                            entry.mount
                              ? sources.find(
                                  (candidate) =>
                                    candidate.id === entry.mount!.sourceId,
                                )?.label ?? entry.mount.sourceId
                              : undefined
                          }
                        />
                      )}
                    </div>
                  </div>
                  <div className="border-t border-base-300 p-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
                        {t("workspace.attached_chats")}
                      </span>
                      <button
                        type="button"
                        onClick={attachChat}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-base-content/50 transition hover:bg-base-200 hover:text-accent"
                        title={t("workspace.attach_chat")}
                        aria-label={t("workspace.attach_chat")}
                      >
                        <Add size={15} />
                      </button>
                    </div>
                    <div className="mt-1 max-h-44 overflow-y-auto">
                      {attachedChats.length === 0 ? (
                        <p className="px-1 py-1 text-[10px] text-base-content/50">
                          {t("workspace.no_attached_chats")}
                        </p>
                      ) : (
                        attachedChats.map((chat) => (
                          <div
                            key={chat.id}
                            className="group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-base-200"
                          >
                            <button
                              type="button"
                              onClick={() => navigate(`/chat/${chat.id}`)}
                              className="min-w-0 flex-1 truncate text-left text-xs text-base-content"
                            >
                              {chat.title || t("conversation.untitled")}
                            </button>
                            <button
                              type="button"
                              onClick={() => detachChat(chat.id)}
                              className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-error/10 hover:text-error group-hover:opacity-100"
                              title={t("workspace.detach_chat")}
                              aria-label={t("workspace.detach_chat")}
                            >
                              <TrashCan size={12} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="border-t border-base-300 p-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
                        {t("workspace.agents")}
                      </span>
                      <button
                        type="button"
                        onClick={attachAgent}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-base-content/50 transition hover:bg-base-200 hover:text-accent"
                        title={t("workspace.attach_agent")}
                        aria-label={t("workspace.attach_agent")}
                      >
                        <Add size={15} />
                      </button>
                    </div>
                    <div className="mt-1 max-h-44 overflow-y-auto">
                      {attachedAgents.length === 0 ? (
                        <p className="px-1 py-1 text-[10px] text-base-content/50">
                          {t("workspace.no_attached_agents")}
                        </p>
                      ) : (
                        attachedAgents.map((agent) => (
                          <div
                            key={agent.id}
                            className="group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-base-200"
                          >
                            <button
                              type="button"
                              onClick={() => navigate(`/agent/${agent.id}`)}
                              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                            >
                              <Bot size={12} className="shrink-0 text-base-content/50" />
                              <span className="min-w-0 flex-1 truncate text-[11px] text-base-content/80">
                                {agent.name}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => detachAgent(agent.id)}
                              className="flex h-4 w-4 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:text-error group-hover:opacity-100"
                              title={t("workspace.detach_agent")}
                              aria-label={t("workspace.detach_agent")}
                            >
                              ×
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </aside>

                <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100">
                  {!selectedProvider ? (
                    <div className="flex flex-1 flex-col">
                      <WorkspaceRootBrowser
                        path={rootPath}
                        rootPath="/"
                        breadcrumbs={rootBreadcrumbs}
                        entries={rootEntries}
                        loading={rootLoading}
                        error={rootError}
                        onNavigate={setRootPath}
                        onRetry={() => void loadRoot()}
                        onOpen={(entry) => {
                          if (entry.mount) {
                            openMount(entry.mount);
                            return;
                          }
                          if (entry.kind === "dir") {
                            setRootPath(entry.path);
                            return;
                          }
                          void openFile(entry, rootProvider);
                        }}
                        onUpload={triggerUpload}
                        uploading={uploading}
                        uploadDisabled={uploadDisabled}
                        onNewFolder={() => createRootEntry("dir")}
                        onNewFile={() => createRootEntry("file")}
                        onAddFolder={() => addFolder()}
                        canDragEntry={(entry) => entry.local && !entry.mount}
                        onDragStart={(entry, event) => {
                          if (!entry.local || entry.mount) return;
                          setDraggingEntry({
                            sourceId: entry.sourceId,
                            entry,
                          });
                          event.dataTransfer.setData(
                            "application/x-chat-ai-workspace",
                            JSON.stringify({
                              sourceId: entry.sourceId,
                              entry,
                            }),
                          );
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggingEntry(null);
                          setDragHint(null);
                        }}
                        onDragOverEntry={(entry, event) => {
                          if (entry.kind !== "dir") return;
                          event.preventDefault();
                          if (!draggingEntry) return;
                          setDragHint("move");
                        }}
                        onDragLeaveEntry={() => setDragHint(null)}
                        onDropEntry={(entry, event) => {
                          if (entry.kind === "dir" && !entry.mount) {
                            onDrop(event, entry.sourceId, entry.path);
                          } else if (entry.mount) {
                            onDrop(
                              event,
                              entry.mount.sourceId,
                              entry.mount.sourcePath,
                            );
                          }
                        }}
                        onDragOverFiles={(event) => {
                          event.preventDefault();
                          if (!draggingEntry) return;
                          setDragHint("move");
                        }}
                        onDragLeaveFiles={() => setDragHint(null)}
                        onDropFiles={(event) => {
                          setDragHint(null);
                          onDrop(event, rootSourceId, rootPath);
                        }}
                        isReadOnly={rootEntryReadOnly}
                        sourceLabel={rootEntrySourceLabel}
                        entryActions={renderRootEntryActions}
                        emptyHint={t("workspace.root_empty_hint")}
                      />
                    </div>
                  ) : (
                    <WorkspaceRootBrowser
                      path={currentPath}
                      rootPath="/"
                      breadcrumbs={breadcrumbs}
                      entries={entries}
                      loading={loading}
                      error={
                        selectedSource?.status === "error"
                          ? t("workspace.source_unavailable")
                          : listError
                      }
                      onHome={() => {
                        setActiveMountId(null);
                        setSelectedSourceId(null);
                      }}
                      onBreadcrumb={(crumb, index) => {
                        if (index === 0) {
                          setActiveMountId(null);
                          setSelectedSourceId(null);
                          return;
                        }
                        setPathBySource((current) => ({
                          ...current,
                          [selectedSourceId!]: crumb.path,
                        }));
                      }}
                      onNavigate={(nextPath) =>
                        setPathBySource((current) => ({
                          ...current,
                          [selectedSourceId!]: nextPath,
                        }))
                      }
                      onRetry={() => void loadEntries(false)}
                      onOpen={(entry) => {
                        if (entry.kind === "dir") {
                          setPathBySource((current) => ({
                            ...current,
                            [selectedSourceId!]: entry.path,
                          }));
                          return;
                        }
                        void openFile(entry);
                      }}
                      onUpload={triggerUpload}
                      uploading={uploading}
                      uploadDisabled={uploadDisabled}
                      onNewFolder={
                        selectedProvider?.capabilities?.mkdir &&
                        !selectedSource?.readOnly &&
                        !activeMount?.readOnly
                          ? () => createSourceEntry("dir")
                          : undefined
                      }
                      onNewFile={
                        selectedProvider?.capabilities?.write &&
                        !selectedSource?.readOnly &&
                        !activeMount?.readOnly
                          ? () => createSourceEntry("file")
                          : undefined
                      }
                      toolbarInfo={
                        <>
                          {activeMount?.readOnly && (
                            <span className="badge badge-warning badge-xs">
                              {t("workspace.mount_read_only")}
                            </span>
                          )}
                          <span className="text-[10px] text-base-content/50">
                            {selectedSource?.label}
                          </span>
                        </>
                      }
                      canDragEntry={() => true}
                      onDragStart={(entry, event) => {
                        setDraggingEntry({
                          sourceId: selectedSourceId!,
                          entry,
                        });
                        event.dataTransfer.setData(
                          "application/x-chat-ai-workspace",
                          JSON.stringify({
                            sourceId: selectedSourceId,
                            entry,
                          }),
                        );
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggingEntry(null);
                        setDragHint(null);
                      }}
                      onDragOverEntry={(entry, event) => {
                        if (entry.kind !== "dir") return;
                        event.preventDefault();
                        if (!draggingEntry) return;
                        setDragHint("move");
                      }}
                      onDragLeaveEntry={() => setDragHint(null)}
                      onDropEntry={(entry, event) => {
                        if (entry.kind === "dir") {
                          onDrop(event, selectedSourceId!, entry.path);
                        }
                      }}
                      onDragOverFiles={(event) => {
                        event.preventDefault();
                        if (!draggingEntry) return;
                        setDragHint("move");
                      }}
                      onDragLeaveFiles={() => setDragHint(null)}
                      onDropFiles={(event) => {
                        setDragHint(null);
                        if (activeMount?.readOnly) {
                          notifyError(t("workspace.mount_read_only_error"));
                          return;
                        }
                        if (selectedSource?.readOnly) {
                          notifyError(t("workspace.source_read_only_error"));
                          return;
                        }
                        onDrop(event, selectedSourceId!, currentPath);
                      }}
                      entryActions={(entry) => (
                        <>
                          {selectedProvider?.capabilities?.rename === true &&
                            selectedSource?.readOnly !== true &&
                            activeMount?.readOnly !== true && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  renameEntry(entry, selectedProvider, () =>
                                    loadEntries(false),
                                  );
                                }}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-base-200 hover:text-base-content group-hover:opacity-100"
                                title={t("common.rename")}
                                aria-label={t("common.rename")}
                              >
                                <Edit size={12} />
                              </button>
                            )}
                          {entry.kind === "file" && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void downloadEntry(entry);
                              }}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-base-200 hover:text-base-content group-hover:opacity-100"
                              title={t("workspace.download")}
                              aria-label={t("workspace.download")}
                            >
                              <Download size={12} />
                            </button>
                          )}
                          {entry.kind === "file" && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openModal("workspaceMoveTo", {
                                  entry,
                                  sources: sources.filter(
                                    (candidate) =>
                                      candidate.id !== selectedSourceId &&
                                      candidate.status !== "error" &&
                                      !candidate.readOnly,
                                  ),
                                  onSelect: (targetId: string) =>
                                    requestTransfer({
                                      fromSourceId: selectedSourceId!,
                                      toSourceId: targetId,
                                      entry,
                                      targetDir: "/",
                                      intent: "move",
                                    }),
                                });
                              }}
                              className="shrink-0 rounded px-1 text-[10px] text-base-content/40 opacity-0 transition hover:bg-base-300 hover:text-base-content group-hover:opacity-100"
                              title={t("workspace.move_to")}
                            >
                              {t("workspace.move_to")}
                            </button>
                          )}
                          {canDeleteSourceEntry(entry) && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                requestDeleteSourceEntry(entry);
                              }}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-error/10 hover:text-error group-hover:opacity-100"
                              title={t("common.delete")}
                              aria-label={t("common.delete")}
                            >
                              <TrashCan size={12} />
                            </button>
                          )}
                        </>
                      )}
                      footer={
                        nextCursor ? (
                          <div className="p-2 text-center">
                            <button
                              type="button"
                              className="btn btn-xs"
                              onClick={() => loadEntries(true)}
                              disabled={loading}
                            >
                              {t("workspace.load_more")}
                            </button>
                          </div>
                        ) : null
                      }
                      emptyHint={t("workspace.drop_hint")}
                      dataGuide="workspace-files"
                    />
                  )}
                </section>

                {preview && (
                  <WorkspaceFilePanel
                    preview={preview}
                    onClose={closePreview}
                    onDownload={download}
                  />
                )}
              </div>
            </>
          )}
        </div>
        {transferring && (
          <div className="pointer-events-none fixed bottom-20 right-6 z-50 rounded-full bg-base-100 px-3 py-1 text-xs font-semibold shadow-lg ring-1 ring-base-300">
            {t("workspace.transferring")}
          </div>
        )}
        {dragHint && (
          <div className="pointer-events-none fixed bottom-20 right-6 z-50 rounded-full bg-base-100 px-3 py-1 text-xs font-semibold shadow-lg ring-1 ring-base-300">
            {dragHint === "move"
              ? t("workspace.transfer_move")
              : t("workspace.transfer_copy")}
          </div>
        )}
        <CollapsibleFooter className="row-start-3 col-span-full md:row-start-2 md:col-start-1 md:col-end-3" />
      </div>
    </div>
  );
}
