import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import {
  Add,
  Bot,
  ChevronRight,
  Download,
  Folder,
  FolderAdd,
  Home,
  TrashCan,
  WarningAltFilled,
} from "@carbon/icons-react";

import Header from "../components/Header/Header";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import { useModal } from "../modals/ModalContext";
import { useToast } from "../hooks/useToast";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { formatBytes } from "../utils/formatBytes";
import { useConversationList } from "../db";
import {
  deleteWorkspace,
  detachWorkspaceChat,
  getDeviceId,
  removeSource,
  removeWorkspaceMount,
  saveTransfer,
  syncWorkspacesFromServer,
  usePendingTransfers,
  useWorkspace,
  useWorkspaceChats,
  useWorkspaceMounts,
  useWorkspaceSources,
} from "../db/workspaceDb";
import type { WorkspaceFileEntry } from "../db/dbTypes";
import { DEVICE_PLANE_KINDS } from "../workspace/deviceId";
import { useWorkspaceProviders } from "../workspace/useWorkspaceProviders";
import { planTransfer } from "../workspace/transferPlanner";
import { runTransfer } from "../workspace/transfer";
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
  const { notifyError } = useToast();
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
  const pendingTransfers = usePendingTransfers(workspaceId);
  const resumedRef = useRef<Set<string>>(new Set());
  const { providers, reconnect } = useWorkspaceProviders(sources);

  useEffect(() => {
    void syncWorkspacesFromServer();
  }, []);
  const sidebarState = useMemo(
    () => ({ id: "", title: "", messages: [], folderId: null, settings: { model: "" } }),
    [],
  );

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
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
  } | null>(null);
  const [quotas, setQuotas] = useState<Record<string, QuotaInfo | null>>({});
  const [transferring, setTransferring] = useState(false);
  const [draggingEntry, setDraggingEntry] = useState<{
    sourceId: string;
    entry: WorkspaceFileEntry;
  } | null>(null);
  const [dragHint, setDragHint] = useState<"copy" | "move" | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const selectedSource = sources.find((source) => source.id === selectedSourceId);
  const selectedProvider = selectedSourceId
    ? providers.get(selectedSourceId)
    : undefined;
  const currentPath = selectedSourceId
    ? pathBySource[selectedSourceId] ?? "/"
    : "/";

  useEffect(() => {
    if (
      selectedSourceId &&
      !sources.some((source) => source.id === selectedSourceId)
    ) {
      setSelectedSourceId(null);
    }
  }, [sources, selectedSourceId]);

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

  const openFile = async (entry: WorkspaceFileEntry) => {
    if (!selectedProvider) return;
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
        const bytes = await readAll(await selectedProvider.read(entry.path));
        setPreview({
          entry,
          loading: false,
          text: new TextDecoder().decode(bytes),
        });
        return;
      }
      const bytes = await readAll(await selectedProvider.read(entry.path));
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

  const download = (entry: WorkspaceFileEntry) => {
    if (!preview?.url) return;
    const link = document.createElement("a");
    link.href = preview.url;
    link.download = entry.name;
    link.click();
  };

  const addSource = () => {
    openModal("workspaceAddSource", {
      workspaceId,
      onAdded: () => setSelectedSourceId(null),
    });
  };

  const addFolder = () => {
    openModal("workspaceAddMount", {
      workspaceId,
      sources,
      mounts,
      onAdded: () => setSelectedSourceId(null),
    });
  };

  const openMount = (mount: { sourceId: string; sourcePath: string }) => {
    setSelectedSourceId(mount.sourceId);
    setPathBySource((current) => ({
      ...current,
      [mount.sourceId]: normalizePath(mount.sourcePath),
    }));
  };

  const removeMount = (mountId: string) => {
    void removeWorkspaceMount(workspaceId!, mountId);
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
    const from = providers.get(fromSourceId);
    const to = providers.get(toSourceId);
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
    altKey,
    intent = "auto",
  }: {
    fromSourceId: string;
    toSourceId: string;
    entry: WorkspaceFileEntry;
    targetDir: string;
    altKey: boolean;
    intent?: "auto" | "move" | "copy";
  }) => {
    const from = providers.get(fromSourceId);
    const to = providers.get(toSourceId);
    if (!from || !to) return;
    const sameSource = fromSourceId === toSourceId;
    const plan = planTransfer({
      intent,
      alt: altKey,
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
    const fromLabel = sources.find((source) => source.id === fromSourceId)?.label ?? "";
    const toLabel = sources.find((source) => source.id === toSourceId)?.label ?? "";
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
        altKey: event.altKey,
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

  return (
    <div className="h-dvh grid grid-rows-[auto_1fr]">
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
                        onClick={addFolder}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-base-content/50 transition hover:bg-base-200 hover:text-accent"
                        title={t("workspace.add_folder")}
                        aria-label={t("workspace.add_folder")}
                      >
                        <FolderAdd size={15} />
                      </button>
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
                              const same = draggingEntry.sourceId === source.id;
                              setDragHint(event.altKey ? "move" : same ? "move" : "copy");
                            }}
                            onDragLeave={() => setDragHint(null)}
                            onDragEnd={() => setDragHint(null)}
                            onDrop={(event) => {
                              if (unavailable) return;
                              setDragHint(null);
                              onDrop(event, source.id, "/");
                            }}
                            className={`mb-1 rounded-lg border px-2 py-1.5 transition ${
                              active
                                ? "border-accent/40 bg-accent/10"
                                : "border-transparent hover:bg-base-200"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedSourceId(source.id)}
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
                                onClick={() =>
                                  removeSelectedSource(source.id, source.label)
                                }
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
                              {unavailable && (
                                <span className="badge badge-error badge-xs">
                                  {t("workspace.unavailable_on_device")}
                                </span>
                              )}
                              {source.status === "needs-permission" && (
                                <button
                                  type="button"
                                  className="badge badge-warning badge-xs cursor-pointer"
                                  onClick={() => reconnect(source.id)}
                                >
                                  {t("workspace.reconnect")}
                                </button>
                              )}
                              {source.status === "error" && (
                                <button
                                  type="button"
                                  className="badge badge-error badge-xs cursor-pointer"
                                  onClick={() => reconnect(source.id)}
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
                </aside>

                <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100">
                  {!selectedProvider ? (
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2 text-xs">
                        <span className="font-medium">{t("workspace.root")}</span>
                        <button
                          type="button"
                          onClick={addFolder}
                          className="ml-auto btn btn-ghost btn-xs"
                        >
                          <FolderAdd size={14} />
                          {t("workspace.add_folder")}
                        </button>
                      </div>
                      <div
                        data-guide="workspace-files"
                        className="flex-1 overflow-y-auto p-1.5"
                      >
                        {mounts.length === 0 ? (
                          <button
                            type="button"
                            onClick={addFolder}
                            className="flex w-full flex-col items-start gap-1 rounded-lg border border-dashed border-base-300 px-3 py-2 text-left text-xs text-base-content/60 transition hover:border-accent/40 hover:bg-base-200/60"
                          >
                            <Folder size={16} className="text-accent" />
                            {t("workspace.no_mounts")}
                          </button>
                        ) : (
                          mounts.map((mount) => {
                            const source = sources.find(
                              (candidate) => candidate.id === mount.sourceId,
                            );
                            return (
                              <div
                                key={mount.id}
                                className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-base-200"
                              >
                                <button
                                  type="button"
                                  onClick={() => openMount(mount)}
                                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                >
                                  <Folder size={14} className="text-accent" />
                                  <span className="min-w-0 flex-1 truncate font-mono text-base-content">
                                    {mount.path}
                                  </span>
                                  <span className="shrink-0 text-[10px] text-base-content/40">
                                    {source?.label ?? mount.sourceId}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeMount(mount.id)}
                                  className="flex h-5 w-5 items-center justify-center rounded text-base-content/40 opacity-0 transition hover:bg-error/10 hover:text-error group-hover:opacity-100"
                                  title={t("workspace.remove_mount")}
                                  aria-label={t("workspace.remove_mount")}
                                >
                                  <TrashCan size={12} />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 border-b border-base-300 px-3 py-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedSourceId(null)}
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
                              onClick={() => {
                                if (index === 0) {
                                  setSelectedSourceId(null);
                                  return;
                                }
                                setPathBySource((current) => ({
                                  ...current,
                                  [selectedSourceId!]: crumb.path,
                                }));
                              }}
                              className="max-w-[12rem] truncate rounded px-1 py-0.5 hover:bg-base-200"
                            >
                              {crumb.label}
                            </button>
                          </span>
                        ))}
                        <span className="ml-auto text-[10px] text-base-content/50">
                          {selectedSource?.label}
                        </span>
                      </div>

                      <div
                        data-guide="workspace-files"
                        className="flex-1 overflow-y-auto p-1.5"
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (draggingEntry) {
                            const same = draggingEntry.sourceId === selectedSourceId;
                            setDragHint(event.altKey ? "move" : same ? "move" : "copy");
                          }
                        }}
                        onDragLeave={() => setDragHint(null)}
                        onDrop={(event) => {
                          setDragHint(null);
                          onDrop(event, selectedSourceId!, currentPath);
                        }}
                      >
                        {loading && entries.length === 0 ? (
                          <div className="space-y-1 p-2">
                            {Array.from({ length: 5 }).map((_, index) => (
                              <div
                                key={index}
                                className="h-8 animate-pulse rounded bg-base-200"
                              />
                            ))}
                          </div>
                        ) : listError ? (
                          <div className="flex flex-col items-center gap-2 p-8 text-center text-xs text-base-content/60">
                            <WarningAltFilled size={20} className="text-warning" />
                            <p>{listError}</p>
                            <button className="btn btn-xs" onClick={() => loadEntries(false)}>
                              {t("workspace.retry")}
                            </button>
                          </div>
                        ) : entries.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 p-8 text-center text-xs text-base-content/60">
                            <Folder size={20} className="text-base-content/30" />
                            <p>{t("workspace.empty_folder")}</p>
                            <p className="text-[10px] text-base-content/40">
                              {t("workspace.drop_hint")}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {currentPath !== "/" && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPathBySource((current) => ({
                                    ...current,
                                    [selectedSourceId!]: parentPath(currentPath),
                                  }))
                                }
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/70 hover:bg-base-200"
                              >
                                <Folder size={14} />
                                ..
                              </button>
                            )}
                            {entries.map((entry) => (
                              <div
                                key={entry.path}
                                draggable
                                onDragStart={(event) => {
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
                                  event.dataTransfer.effectAllowed = "copyMove";
                                }}
                                onDragEnd={() => {
                                  setDraggingEntry(null);
                                  setDragHint(null);
                                }}
                                onDragOver={
                                  entry.kind === "dir"
                                    ? (event) => event.preventDefault()
                                    : undefined
                                }
                                onDrop={
                                  entry.kind === "dir"
                                    ? (event) =>
                                        onDrop(event, selectedSourceId!, entry.path)
                                    : undefined
                                }
                                onClick={() => openFile(entry)}
                                className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-base-200"
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
                                            candidate.status !== "error",
                                        ),
                                        onSelect: (targetId: string) =>
                                          requestTransfer({
                                            fromSourceId: selectedSourceId!,
                                            toSourceId: targetId,
                                            entry,
                                            targetDir: "/",
                                            altKey: false,
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
                                {entry.kind === "file" && typeof entry.size === "number" && (
                                  <span className="shrink-0 text-[10px] text-base-content/40">
                                    {formatBytes(entry.size)}
                                  </span>
                                )}
                                {entry.kind === "dir" &&
                                  typeof entry.childCount === "number" && (
                                    <span className="shrink-0 text-[10px] text-base-content/40">
                                      {entry.childCount}
                                    </span>
                                  )}
                              </div>
                            ))}
                          </div>
                        )}
                        {nextCursor && (
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
                        )}
                      </div>
                    </>
                  )}
                </section>

                {preview && (
                  <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100">
                    <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {preview.entry.name}
                      </span>
                      {preview.url && (
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded text-base-content/60 hover:bg-base-200"
                          onClick={() => download(preview.entry)}
                          title={t("workspace.download")}
                        >
                          <Download size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-base-content/50 hover:text-base-content"
                        onClick={closePreview}
                        aria-label={t("common.close")}
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex-1 overflow-auto p-3 text-xs">
                      {preview.loading ? (
                        <div className="h-24 animate-pulse rounded bg-base-200" />
                      ) : preview.error ? (
                        <p className="text-error">{preview.error}</p>
                      ) : preview.text !== undefined ? (
                        <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-base-content">
                          {preview.text}
                        </pre>
                      ) : preview.url ? (
                        preview.entry.mime?.startsWith("image/") ? (
                          <img
                            src={preview.url}
                            alt={preview.entry.name}
                            className="max-w-full rounded"
                          />
                        ) : preview.entry.mime === "application/pdf" ? (
                          <iframe
                            src={preview.url}
                            title={preview.entry.name}
                            className="h-[70vh] w-full rounded"
                          />
                        ) : preview.entry.mime?.startsWith("audio/") ? (
                          <audio src={preview.url} controls className="w-full" />
                        ) : preview.entry.mime?.startsWith("video/") ? (
                          <video src={preview.url} controls className="w-full rounded" />
                        ) : (
                          <p className="text-base-content/60">
                            {t("workspace.preview_unavailable")}
                          </p>
                        )
                      ) : null}
                    </div>
                  </aside>
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
