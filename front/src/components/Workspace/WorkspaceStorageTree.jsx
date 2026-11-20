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
  Upload,
} from "@carbon/icons-react";

import { useConversationList } from "../../db";
import {
  removeWorkspaceMount,
  useWorkspaceChats,
  useWorkspaceMounts,
  useWorkspaceSources,
} from "../../db/workspaceDb";
import { useModal } from "../../modals/ModalContext";
import { chatFolderLabel } from "../../workspace/chatFolderName";
import { listWorkspaceRoot } from "../../workspace/listWorkspaceRoot";
import { joinPath } from "../../workspace/paths";
import { readProviderPreview } from "../../workspace/filePreview";
import { uploadLocalFiles } from "../../workspace/upload";
import { useWorkspaceProviders } from "../../workspace/useWorkspaceProviders";
import { WORKSPACE_FILES_CHANGED_EVENT } from "../../workspace/filesChanged";
import {
  createWorkspaceRootProvider,
  emptyStream,
} from "../../workspace/workspaceRoot";

const errorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

// How long a "new" or "changed" dot keeps its place before the row goes quiet.
const FILE_MARK_MS = 4000;

const nodeKey = (node) =>
  node.context
    ? `${node.context.mount?.id ?? node.context.provider.sourceId}:${node.context.sourcePath}`
    : node.displayPath;

// The Files tab is unmounted while another tab is showing, and with it every row's open
// state. Which folders are unfolded belongs to the workspace, not to the mount, so it is
// kept here for the session and rebuilt on the way back.
const expandedByWorkspace = new Map();

const expandedSet = (workspaceId) => {
  let set = expandedByWorkspace.get(workspaceId);
  if (!set) {
    set = new Set();
    expandedByWorkspace.set(workspaceId, set);
  }
  return set;
};

/** Test hook: forget which folders were unfolded. */
export const resetExpandedFolders = () => expandedByWorkspace.clear();

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

function StorageRow({ node, depth, api }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => api.isExpanded?.(node) ?? false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isDir = node.entry.kind === "dir";
  const isSelected = api.selectedKey === nodeKey(node);
  const mark = isDir ? null : api.markFor?.(node);

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

  // A row that comes back unfolded (after a tab switch) has nothing underneath it yet.
  useEffect(() => {
    if (!open || children !== null || loading) return;
    void loadChildren();
  }, [open, children, loading, loadChildren]);

  // A refresh has to reach every open folder, not just the root: a row keeps its
  // own children, so nothing above it can replace them.
  const revisionRef = useRef(api.revision ?? 0);
  useEffect(() => {
    const revision = api.revision ?? 0;
    if (revisionRef.current === revision) return;
    revisionRef.current = revision;
    if (open) {
      void loadChildren();
      return;
    }
    // Collapsed rows drop what they had, so the next expand lists fresh.
    setChildren(null);
    setError("");
  }, [api.revision, open, loadChildren]);

  const toggle = () => {
    api.selectNode?.(node);
    if (!isDir) {
      api.openFile?.(node);
      return;
    }
    api.selectTarget({ ...node, reload });
    if (!open) {
      setOpen(true);
      api.setExpanded?.(node, true);
      if (children === null && !loading) void loadChildren();
      return;
    }
    setOpen(false);
    api.setExpanded?.(node, false);
  };

  const badge = api.badgeFor(node);
  const label = api.labelFor(node);
  const readOnly = api.isReadOnly?.(node) ?? false;
  const childDepth = depth + 1;

  return (
    <div>
      <div
        data-guide="workspace-row"
        className={`group flex items-center gap-1 rounded pr-1 text-[11px] ${
          isSelected ? "bg-accent/10" : "hover:bg-base-200/70"
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
          ) : mark ? (
            // A new file wears a green dot where a folder's arrow would be, a file the
            // agent changed an amber one; the key restarts the fade on every new write.
            <span className="flex w-3 shrink-0 items-center justify-center">
              <span
                key={`${mark.kind}-${mark.at}`}
                data-guide="file-mark"
                data-mark={mark.kind}
                className={`pointer-events-none h-1.5 w-1.5 rounded-full ${
                  mark.kind === "create" ? "bg-success" : "bg-warning"
                } animate-[file-mark-fade_4s_ease-out_forwards]`}
              />
            </span>
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
          {readOnly && (
            <span
              className="shrink-0 text-warning"
              title={t("workspace.mount_read_only")}
              aria-label={t("workspace.mount_read_only")}
            >
              <Locked size={11} />
            </span>
          )}
          {/* The pill always ends the row and keeps one width, so every
              location lines up no matter how long its label is. */}
          {badge && (
            <span className="inline-flex w-14 shrink-0 items-center justify-center rounded-full border border-base-300 px-1.5 py-px text-[9px] font-medium tracking-wide text-base-content/55">
              {badge}
            </span>
          )}
        </button>
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
  onPreview,
  allowDetach = false,
}) {
  const { t } = useTranslation();
  const { openModal } = useModal();
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
  const [selected, setSelected] = useState(null);
  const [detaching, setDetaching] = useState(false);
  // Rows the agent just created or changed, by workspace path, until their dot fades.
  const [marks, setMarks] = useState({});
  const markTimersRef = useRef(new Map());
  const requestRef = useRef(0);
  const previewSeqRef = useRef(0);

  const markFile = useCallback((path, kind) => {
    if (!path || (kind !== "create" && kind !== "modify")) return;
    setMarks((current) => {
      // A file that is still new stays green while the agent keeps writing to it.
      const next = current[path]?.kind === "create" ? "create" : kind;
      return { ...current, [path]: { kind: next, at: Date.now() } };
    });
    const timers = markTimersRef.current;
    const previous = timers.get(path);
    if (previous) window.clearTimeout(previous);
    timers.set(
      path,
      window.setTimeout(() => {
        timers.delete(path);
        setMarks((current) => {
          if (!current[path]) return current;
          const next = { ...current };
          delete next[path];
          return next;
        });
      }, FILE_MARK_MS),
    );
  }, []);

  useEffect(
    () => () => {
      for (const timer of markTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      markTimersRef.current.clear();
    },
    [],
  );

  // One signal for "list everything again": the root here, and every open row
  // through `api.revision`.
  const bumpRevision = useCallback(
    () => setRootRevision((value) => value + 1),
    [],
  );

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
    setSelected(null);
  }, [workspaceId]);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot, workspaceId, rootRevision, mountsKey, sourcesKey]);

  // The agent's own writes are announced by the workspace VFS: the tree follows
  // them, coalescing a burst of files into one re-list.
  useEffect(() => {
    if (!workspaceId || typeof window === "undefined") return undefined;
    let timer = null;
    const onChange = (event) => {
      const changedId = event?.detail?.workspaceId;
      if (!changedId || changedId !== workspaceId) return;
      markFile(event.detail.path, event.detail.kind);
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        setRootRevision((value) => value + 1);
      }, 200);
    };
    window.addEventListener(WORKSPACE_FILES_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(WORKSPACE_FILES_CHANGED_EVENT, onChange);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [workspaceId, markFile]);

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
        case "saia-fs":
          return t("workspace.storage_badge_saia");
        case "agent":
          return t("workspace.storage_badge_agent");
        default:
          // Browser storage is the workspace's own root, so it is what every row
          // without a source already is: a "browser" pill would only restate the
          // absence of the other sources, which carry their own.
          return undefined;
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
      // Root files, the synthetic /chats folder and the parents of a nested
      // mount: only the last has a source of its own, and it carries that
      // source's pill. Browser storage stays unlabelled.
      const mount = mountForPath(node.entry.path);
      return mount ? badgeForSource(sourceForMount(mount)) : undefined;
    },
    [badgeForSource, mountForPath, sourceForMount],
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

  // Every row can be selected, whether or not it is an upload target: the
  // selection is what the Detach button acts on.
  const selectNode = useCallback((node) => {
    setActionError("");
    // Only a row that is itself mounted into the workspace can be detached —
    // a file inside a mounted folder belongs to that folder's source.
    const mount = node.entry?.mount ?? null;
    setSelected({ key: nodeKey(node), mount: mount ?? null });
  }, []);

  const detachSelection = async () => {
    const mount = selected?.mount;
    if (!workspaceId || !mount || detaching) return;
    setDetaching(true);
    setActionError("");
    try {
      await removeWorkspaceMount(workspaceId, mount.id);
      setSelected(null);
      setTarget(rootTarget());
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setDetaching(false);
    }
  };

  const targetProvider = () => {
    if (target.provider) return target.provider;
    if (target.mount) {
      return providersRef.current.get(target.mount.sourceId) ?? null;
    }
    return rootProvider;
  };

  // A file row asks the preview pane to show its content. The pane gets a
  // loading request at once, then the bytes (or a plain error).
  const openFile = useCallback(
    async (node) => {
      if (!onPreview || !node || node.entry?.kind !== "file") return;
      // Clicking a second file while the first is still reading must not let the
      // slower read replace the newer preview.
      const sequence = (previewSeqRef.current += 1);
      const entry = {
        name: node.entry.name,
        mime: node.entry.mime,
        size: node.entry.size,
      };
      onPreview({ entry, loading: true });
      const mount = node.context?.mount ?? node.entry.mount;
      const provider =
        node.context?.provider ??
        (mount ? providersRef.current.get(mount.sourceId) : null) ??
        rootProvider;
      if (!provider) {
        onPreview({ entry, error: "This file cannot be previewed" });
        return;
      }
      const sourcePath = node.context
        ? node.context.sourcePath
        : node.displayPath;
      try {
        if (provider.status !== "connected") await provider.connect();
        const result = await readProviderPreview(provider, {
          ...node.entry,
          path: sourcePath,
          kind: "file",
        });
        if (sequence !== previewSeqRef.current) {
          result.release?.();
          return;
        }
        onPreview(result);
      } catch (reason) {
        if (sequence !== previewSeqRef.current) return;
        onPreview({ entry, error: errorMessage(reason) });
      }
    },
    [onPreview, rootProvider],
  );

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
      for (const file of files) markFile(joinPath(target.path, file.name), "create");
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
          markFile(joinPath(folder.path, name), "create");
        }
        await folder.reload?.();
      },
    });
  };

  const api = {
    selectedKey: selected?.key ?? null,
    revision: rootRevision,
    markFor: (node) => marks[node.displayPath] ?? null,
    isExpanded: (node) => expandedSet(workspaceId).has(nodeKey(node)),
    setExpanded: (node, value) => {
      const set = expandedSet(workspaceId);
      if (value) set.add(nodeKey(node));
      else set.delete(nodeKey(node));
    },
    badgeFor,
    labelFor,
    loadChildren,
    selectTarget,
    selectNode,
    openFile,
    isReadOnly: readOnlyFor,
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
          <div className="ml-auto flex items-center gap-1">
            {allowDetach && selected && (
              <button
                type="button"
                data-guide="workspace-detach"
                onClick={() => void detachSelection()}
                disabled={!selected.mount || detaching}
                title={
                  selected.mount
                    ? t("workspace.detach_hint")
                    : t("workspace.detach_mount_only")
                }
                className="btn btn-secondary btn-xs shrink-0 gap-1"
              >
                {detaching && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                <span className="truncate">{t("workspace.detach")}</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              onClick={bumpRevision}
              title={t("workspace.refresh")}
              aria-label={t("workspace.refresh")}
            >
              <Renew size={14} />
            </button>
          </div>
        </div>
        {actionError && (
          <div className="break-words px-3 py-1 text-[10px] text-error">
            {actionError}
          </div>
        )}
        <div
          data-guide="workspace-files"
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 py-1"
          onClick={(event) => {
            // A click on the empty part of the list drops the wash; a click inside a
            // row is that row's business.
            if (event.target.closest('[data-guide="workspace-row"]')) return;
            if (selected) setSelected(null);
          }}
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
