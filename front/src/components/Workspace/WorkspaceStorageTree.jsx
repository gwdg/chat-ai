import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Document,
  DocumentAdd,
  Folder,
  FolderAdd,
  Locked,
  Renew,
  TrashCan,
  Upload,
} from "@carbon/icons-react";

import { useConversationList } from "../../db";
import {
  useWorkspaceChats,
  useWorkspaceMounts,
  useWorkspaceSources,
} from "../../db/workspaceDb";
import { useModal } from "../../modals/ModalContext";
import { chatFolderLabel } from "../../workspace/chatFolderName";
import { listWorkspaceRoot } from "../../workspace/listWorkspaceRoot";
import { joinPath } from "../../workspace/paths";
import { uploadLocalFiles } from "../../workspace/upload";
import { useWorkspaceProviders } from "../../workspace/useWorkspaceProviders";
import {
  createWorkspaceRootProvider,
  emptyStream,
} from "../../workspace/workspaceRoot";

const errorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

const nodeKey = (node) =>
  node.context
    ? `${node.context.mount?.id ?? node.context.provider.sourceId}:${node.context.sourcePath}`
    : node.displayPath;

const withProviderChildren =
  ({ provider, sourcePath, mount }, parentPath) =>
  (entries) =>
    entries.map((entry) => ({
      entry,
      context: {
        provider,
        sourcePath: entry.path ?? joinPath(sourcePath, entry.name),
        mount,
      },
      displayPath: joinPath(parentPath, entry.name),
    }));

function StorageRow({ node, depth, api, reloadParent }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isDir = node.entry.kind === "dir";
  const isTarget = api.targetKey === nodeKey(node);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await api.loadChildren(node);
      setChildren(next);
    } catch (reason) {
      setError(errorMessage(reason));
      setChildren(null);
    } finally {
      setLoading(false);
    }
  }, [api, node]);

  const reload = useCallback(async () => {
    await loadChildren();
  }, [loadChildren]);

  const toggle = () => {
    if (!isDir) return;
    api.selectTarget({ ...node, reload });
    if (!open) {
      setOpen(true);
      if (children === null && !loading) void loadChildren();
      return;
    }
    setOpen(false);
  };

  const badge = api.badgeFor(node);
  const label = api.labelFor(node);
  const readOnly = api.isReadOnly?.(node) ?? false;
  const deletable =
    node.context === null && node.entry.local === true && !node.entry.mount;
  const childDepth = depth + 1;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded pr-1 text-[11px] ${
          isTarget ? "bg-base-200" : "hover:bg-base-200/70"
        }`}
        style={{ paddingLeft: 4 + depth * 10 }}
      >
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-1 py-0.5 text-left"
          title={node.displayPath}
          aria-expanded={isDir ? open : undefined}
        >
          {isDir ? (
            open ? (
              <ChevronDown size={12} className="shrink-0 text-base-content/50" />
            ) : (
              <ChevronRight
                size={12}
                className="shrink-0 text-base-content/50"
              />
            )
          ) : (
            <span className="w-3 shrink-0" aria-hidden="true" />
          )}
          {isDir ? (
            <Folder size={13} className="shrink-0 text-accent" />
          ) : (
            <Document size={13} className="shrink-0 text-base-content/50" />
          )}
          <span className="min-w-0 flex-1 truncate text-base-content">
            {label}
          </span>
          {badge && (
            <span className="shrink-0 rounded-full border border-base-300 px-1.5 py-px text-[9px] font-medium tracking-wide text-base-content/55">
              {badge}
            </span>
          )}
          {readOnly && (
            <span
              className="shrink-0 text-warning"
              title={t("workspace.mount_read_only")}
              aria-label={t("workspace.mount_read_only")}
            >
              <Locked size={11} />
            </span>
          )}
        </button>
        {deletable && api.onDelete && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              api.onDelete({ ...node, reload: reloadParent });
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-base-content/40 opacity-0 hover:bg-error/10 hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
            title={t("common.delete")}
            aria-label={t("common.delete")}
          >
            <TrashCan size={11} />
          </button>
        )}
      </div>
      {isDir && open && (
        <div>
          {loading && (
            <div
              className="py-0.5 text-[10px] text-base-content/40"
              style={{ paddingLeft: 18 + childDepth * 10 }}
            >
              …
            </div>
          )}
          {!loading && error && (
            <div
              className="break-words py-0.5 text-[10px] text-error"
              style={{ paddingLeft: 18 + childDepth * 10 }}
            >
              {error}
            </div>
          )}
          {!loading &&
            children?.map((child) => (
              <StorageRow
                key={nodeKey(child)}
                node={child}
                depth={childDepth}
                api={api}
                reloadParent={reload}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default function WorkspaceStorageTree({
  workspaceId,
  className = "",
  showTitle = true,
}) {
  const { t } = useTranslation();
  const { openModal, confirmAction } = useModal();
  const sources = useWorkspaceSources(workspaceId ?? undefined);
  const mounts = useWorkspaceMounts(workspaceId ?? undefined);
  useWorkspaceChats(workspaceId ?? undefined);
  const conversations = useConversationList() || [];
  const { providers } = useWorkspaceProviders(sources);
  const rootProvider = useMemo(
    () => (workspaceId ? createWorkspaceRootProvider(workspaceId) : null),
    [workspaceId],
  );
  const uploadInputRef = useRef(null);

  const [rootEntries, setRootEntries] = useState(null);
  const [rootLoading, setRootLoading] = useState(false);
  const [rootError, setRootError] = useState("");
  const [rootRevision, setRootRevision] = useState(0);
  const [actionError, setActionError] = useState("");
  const [uploading, setUploading] = useState(false);
  const requestRef = useRef(0);

  const mountsRef = useRef(mounts);
  mountsRef.current = mounts;
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const providersRef = useRef(providers);
  providersRef.current = providers;

  const mountsKey = useMemo(
    () =>
      mounts
        .map(
          (mount) =>
            `${mount.id}:${mount.sourceId}:${mount.sourcePath}:${mount.path}`,
        )
        .join("|"),
    [mounts],
  );
  const sourcesKey = useMemo(
    () =>
      sources
        .map(
          (source) =>
            `${source.id}:${source.kind}:${source.label}:${
              source.readOnly === true ? "ro" : "rw"
            }`,
        )
        .join("|"),
    [sources],
  );

  const loadRoot = useCallback(async () => {
    const request = ++requestRef.current;
    if (!rootProvider) {
      setRootEntries([]);
      setRootLoading(false);
      setRootError("");
      return;
    }
    setRootLoading(true);
    setRootError("");
    try {
      const next = await listWorkspaceRoot({
        rootProvider,
        workspaceId,
        mounts: mountsRef.current,
        path: "/",
      });
      if (request === requestRef.current) setRootEntries(next);
    } catch (reason) {
      if (request === requestRef.current) {
        setRootError(errorMessage(reason));
        setRootEntries([]);
      }
    } finally {
      if (request === requestRef.current) setRootLoading(false);
    }
  }, [rootProvider, workspaceId]);

  useEffect(() => {
    setRootEntries(null);
  }, [workspaceId]);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot, workspaceId, rootRevision, mountsKey, sourcesKey]);

  const rootTarget = useCallback(
    () => ({
      key: "/",
      path: "/",
      provider: rootProvider,
      sourcePath: "/",
      mount: null,
      reload: loadRoot,
    }),
    [loadRoot, rootProvider],
  );

  const [target, setTarget] = useState(rootTarget);

  useEffect(() => {
    setTarget(rootTarget());
  }, [rootTarget]);

  const sourceForMount = useCallback((mount) => {
    if (!mount) return undefined;
    return sourcesRef.current.find((item) => item.id === mount.sourceId);
  }, []);

  const badgeForSource = useCallback(
    (source) => {
      switch (source?.kind) {
        case "local":
          return t("workspace.storage_badge_device");
        case "arcana":
        case "arcana-filesystem":
          return t("workspace.storage_badge_arcana");
        case "mcp":
          return t("workspace.storage_badge_mcp");
        case "agent":
          return t("workspace.storage_badge_agent");
        case "chat":
        case "browser":
        default:
          return t("workspace.storage_badge_browser");
      }
    },
    [t],
  );

  const mountForPath = useCallback((path) => {
    const exact = mountsRef.current.find((mount) => mount.path === path);
    if (exact) return exact;
    return mountsRef.current
      .filter(
        (mount) =>
          path === mount.path ||
          path.startsWith(`${mount.path.replace(/\/+$/, "")}/`),
      )
      .sort((a, b) => b.path.length - a.path.length)[0];
  }, []);

  // A row is read-only when its own entry says so, when the mount it sits under
  // is read-only, or when its source was switched to read-only. The tree only
  // reports that state; the toggle lives on the source card in the dialog.
  const readOnlyFor = useCallback(
    (node) => {
      if (node.entry?.readOnly === true) return true;
      const mount =
        node.context?.mount ??
        node.entry?.mount ??
        (node.entry?.path ? mountForPath(node.entry.path) : undefined);
      if (mount?.readOnly === true) return true;
      return mount ? sourceForMount(mount)?.readOnly === true : false;
    },
    [mountForPath, sourceForMount],
  );

  const badgeFor = useCallback(
    (node) => {
      if (node.context) {
        return badgeForSource(sourceForMount(node.context.mount));
      }
      if (node.entry.local) return t("workspace.storage_badge_browser");
      // Chats are stored in the browser too, so /chats and everything below it
      // is browser storage even though the folder itself is synthetic.
      const path = node.displayPath ?? node.entry.path;
      if (path === "/chats" || path.startsWith("/chats/")) {
        return t("workspace.storage_badge_browser");
      }
      // Other virtual folders (the parents of a nested mount) carry the pill
      // of whatever is mounted under them.
      const mount = mountForPath(node.entry.path);
      return mount ? badgeForSource(sourceForMount(mount)) : undefined;
    },
    [badgeForSource, mountForPath, sourceForMount, t],
  );

  const labelFor = useCallback(
    (node) =>
      chatFolderLabel(node.displayPath, {
        sources: sourcesRef.current,
        conversations,
      }) ?? node.entry.name,
    [conversations],
  );

  const loadChildren = useCallback(
    async (node) => {
      if (node.context) {
        const { provider, sourcePath, mount } = node.context;
        if (provider.status !== "connected") await provider.connect();
        const page = await provider.list(sourcePath);
        return withProviderChildren(
          { provider, sourcePath, mount },
          node.displayPath,
        )(page.entries);
      }
      if (node.entry.mount) {
        const mount = node.entry.mount;
        const provider = providersRef.current.get(mount.sourceId);
        if (!provider) throw new Error("Source is not available");
        if (provider.status !== "connected") await provider.connect();
        const page = await provider.list(mount.sourcePath);
        return withProviderChildren(
          { provider, sourcePath: mount.sourcePath, mount },
          node.displayPath,
        )(page.entries);
      }
      const entries = await listWorkspaceRoot({
        rootProvider,
        workspaceId,
        mounts: mountsRef.current,
        path: node.displayPath,
      });
      return entries.map((entry) => ({
        entry,
        context: null,
        displayPath: entry.path,
      }));
    },
    [rootProvider, workspaceId],
  );

  const selectTarget = useCallback((node) => {
    setActionError("");
    // /chats and the parents of a nested mount are display-only: they exist to
    // hold mounts, so uploads and new entries must never target them.
    if (!node.context && !node.entry.local && !node.entry.mount) return;
    const mount = node.context?.mount ?? node.entry.mount ?? null;
    setTarget({
      key: nodeKey(node),
      path: node.displayPath,
      provider: node.context
        ? node.context.provider
        : mount
          ? (providersRef.current.get(mount.sourceId) ?? null)
          : null,
      sourcePath: node.context
        ? node.context.sourcePath
        : (mount?.sourcePath ?? node.displayPath),
      mount,
      reload: node.reload,
    });
  }, []);

  const targetProvider = () => {
    if (target.provider) return target.provider;
    if (target.mount) {
      return providersRef.current.get(target.mount.sourceId) ?? null;
    }
    return rootProvider;
  };

  const deleteNode = async (node) => {
    if (!rootProvider) return;
    try {
      await rootProvider.connect();
      await rootProvider.remove(node.entry.path, {
        recursive: node.entry.kind === "dir",
      });
      await node.reload?.();
    } catch (reason) {
      setActionError(errorMessage(reason));
    }
  };

  const requestDelete = (node) => {
    confirmAction(
      {
        warningKey: "warn_workspace_file_delete",
        messageKey:
          node.entry.kind === "dir"
            ? "workspace.delete_folder_confirm"
            : "workspace.delete_file_confirm",
        confirmKey: "common.delete",
        danger: true,
      },
      () => {
        void deleteNode(node);
      },
    );
  };

  const uploadFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const provider = targetProvider();
    if (!provider || files.length === 0) return;
    setUploading(true);
    setActionError("");
    try {
      await provider.connect();
      await uploadLocalFiles(
        provider,
        target.sourcePath,
        files,
        (file, reason) => setActionError(`${file.name}: ${errorMessage(reason)}`),
      );
      await target.reload?.();
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setUploading(false);
    }
  };

  const createEntry = (kind) => {
    const folder = target;
    openModal("workspaceCreateEntry", {
      kind,
      path: folder.path,
      onCreate: async (name) => {
        const provider = targetProvider();
        if (!provider) return;
        await provider.connect();
        const path = joinPath(folder.sourcePath, name);
        if (kind === "dir") {
          await provider.mkdir(path);
        } else {
          await provider.write(path, emptyStream(), { overwrite: false });
        }
        await folder.reload?.();
      },
    });
  };

  const api = {
    targetKey: target.key,
    badgeFor,
    labelFor,
    loadChildren,
    selectTarget,
    isReadOnly: readOnlyFor,
    onDelete: rootProvider ? requestDelete : undefined,
  };

  const showLoading = rootEntries === null;

  return (
    <section
      data-testid="create-workspace-root"
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${className}`}
    >
      <div
        data-testid="workspace-storage-tree"
        data-guide="workspace-storage-tree"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        {showTitle && (
          <div className="flex min-h-[37px] min-w-0 shrink-0 items-center gap-1 border-b border-base-300 px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-semibold leading-tight text-base-content">
                {t("workspace.files_title")}
              </div>
            </div>
          </div>
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-base-300 px-2 py-1">
          <button
            type="button"
            data-guide="workspace-upload"
            className="btn btn-ghost btn-xs"
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={14} />
            {t("workspace.add_file")}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => createEntry("dir")}
          >
            <FolderAdd size={14} />
            {t("workspace.new_folder")}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => createEntry("file")}
          >
            <DocumentAdd size={14} />
            {t("workspace.new_file")}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square ml-auto"
            onClick={() => void loadRoot()}
            title={t("workspace.refresh")}
            aria-label={t("workspace.refresh")}
          >
            <Renew size={14} />
          </button>
        </div>
        {actionError && (
          <div className="break-words px-3 py-1 text-[10px] text-error">
            {actionError}
          </div>
        )}
        <div
          data-guide="workspace-files"
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 py-1"
        >
          {showLoading && (
            <div className="px-2 py-1 text-[10px] text-base-content/40">
              {t("common.loading")}
            </div>
          )}
          {!showLoading && rootError && (
            <div className="break-words px-2 py-1 text-[10px] text-error">
              {rootError}
            </div>
          )}
          {!showLoading &&
            !rootError &&
            rootEntries?.map((entry) => {
              const node = { entry, context: null, displayPath: entry.path };
              return (
                <StorageRow
                  key={nodeKey(node)}
                  node={node}
                  depth={0}
                  api={api}
                  reloadParent={loadRoot}
                />
              );
            })}
          {!showLoading && !rootError && rootEntries?.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center text-[11px] text-base-content/60">
              <Folder size={20} className="text-base-content/30" />
              <p>{t("workspace.root_empty_hint")}</p>
            </div>
          )}
        </div>
      </div>
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={uploadFiles}
      />
    </section>
  );
}
