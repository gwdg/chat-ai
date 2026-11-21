import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Close,
  Document,
  DocumentAdd,
  Download,
  Edit,
  Folder,
  FolderAdd,
  Locked,
  Renew,
  TrashCan,
  Upload,
  WarningAlt,
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
import {
  isWithinPath,
  joinPath,
  normalizePath,
  parentPath,
} from "../../workspace/paths";
import { renameProviderEntry } from "../../workspace/entries";
import {
  canPickDownloadDirectory,
  downloadProviderEntry,
  pickDownloadDirectory,
  saveProviderEntriesToDirectory,
} from "../../workspace/download";
import { WorkspaceError } from "../../workspace/providers/types";
import { streamOf } from "../../workspace/bytes";
import { runTransfer } from "../../workspace/transfer";
import { planTransfer } from "../../workspace/transferPlanner";
import { readProviderPreview } from "../../workspace/filePreview";
import { uploadLocalFiles } from "../../workspace/upload";
import { useWorkspaceProviders } from "../../workspace/useWorkspaceProviders";
import {
  WORKSPACE_FILES_CHANGED_EVENT,
  notifyWorkspaceFilesChanged,
} from "../../workspace/filesChanged";
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

// The payload of a row drag. It carries the provider-relative entry, which is what
// `runTransfer` needs; the sidebar's own chat/session drag types stay separate, so
// only a row of this tree lights a folder up as a drop target.
const WORKSPACE_DRAG_TYPE = "application/x-chat-ai-workspace";
// The open folder's own background is the workspace root. A folder row has a key of
// its own, so the two never highlight at the same time.
const ROOT_DROP_KEY = "__workspace_root__";

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
  // A folder a provider cannot list is reported once and then left alone. Without
  // this flag the auto-load effect below retries forever: a failed attempt ends with
  // `children === null` and `loading === false`, which is exactly the state it waits
  // for, so its own dependency change starts the next attempt. Only an explicit
  // action — opening the row again or a refresh — clears the flag.
  const failedRef = useRef(false);

  const rowKey = nodeKey(node);
  const isDir = node.entry.kind === "dir";
  const isSelected = api.isSelected?.(node) ?? false;
  const mark = isDir ? null : api.markFor?.(node);
  const draggable = api.canDrag?.(node) ?? false;
  const isDropTarget = api.isDropTarget?.(node) ?? false;

  // A shift-click can extend the selection across rows that were never clicked, so
  // the tree needs every rendered row, not only the one the user pressed.
  useEffect(() => {
    api.registerRow?.(rowKey, node);
    return () => api.unregisterRow?.(rowKey);
  }, [api.registerRow, api.unregisterRow, rowKey, node]);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await api.loadChildren(node);
      failedRef.current = false;
      setChildren(next);
    } catch (reason) {
      failedRef.current = true;
      setError(errorMessage(reason));
      setChildren(null);
    } finally {
      setLoading(false);
    }
  }, [api, node]);

  const reload = useCallback(async () => {
    failedRef.current = false;
    await loadChildren();
  }, [loadChildren]);

  // A row that comes back unfolded (after a tab switch) has nothing underneath it yet.
  useEffect(() => {
    if (!open || children !== null || loading) return;
    // Not available is an answer, not something to keep asking: the user opens the
    // row again (or refreshes) to try once more.
    if (failedRef.current) return;
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
      // A refresh is an explicit request, so a folder that failed may be tried again.
      failedRef.current = false;
      void loadChildren();
      return;
    }
    // Collapsed rows drop what they had, so the next expand lists fresh.
    setChildren(null);
    setError("");
  }, [api.revision, open, loadChildren]);

  const toggle = (event) => {
    const extending = Boolean(
      event?.shiftKey || event?.metaKey || event?.ctrlKey,
    );
    api.selectNode?.(node, event);
    // Shift or Ctrl adds to the selection instead of opening: only a plain click
    // unfolds a folder or sends a file to the preview.
    if (extending) return;
    if (!isDir) {
      api.openFile?.(node);
      return;
    }
    api.selectTarget({ ...node, reload });
    if (!open) {
      setOpen(true);
      api.setExpanded?.(node, true);
      if (children === null && !loading) {
        // Clicking the row again is the user's own retry, so it clears the flag.
        failedRef.current = false;
        void loadChildren();
      }
      return;
    }
    setOpen(false);
    api.setExpanded?.(node, false);
  };

  const badge = api.badgeFor(node);
  const label = api.labelFor(node);
  const readOnly = api.isReadOnly?.(node) ?? false;
  const childDepth = depth + 1;
  // A provider usually reports a missing folder with its own path as the message.
  // The sentence already names that folder, so only a real detail is appended.
  const errorDetail =
    error && normalizePath(error) === normalizePath(node.displayPath)
      ? ""
      : error;

  return (
    <div>
      <div
        data-guide="workspace-row"
        data-row-key={rowKey}
        draggable={draggable}
        onDragStart={
          draggable ? (event) => api.onDragStart?.(node, event) : undefined
        }
        onDragEnd={draggable ? () => api.onDragEnd?.() : undefined}
        onDragOver={
          isDir ? (event) => api.onDragOverNode?.(node, event) : undefined
        }
        onDragLeave={
          isDir ? (event) => api.onDragLeaveNode?.(node, event) : undefined
        }
        onDrop={isDir ? (event) => api.onDropNode?.(node, event) : undefined}
        className={`group flex items-center gap-1 rounded pr-1 text-[11px] ${
          isSelected ? "bg-accent/10" : "hover:bg-base-200/70"
        } ${
          isDropTarget ? "bg-accent/15 ring-1 ring-inset ring-primary" : ""
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
        <div
          onDragOver={(event) => api.onDragOverNode?.(node, event)}
          onDragLeave={(event) => api.onDragLeaveNode?.(node, event)}
          onDrop={(event) => api.onDropNode?.(node, event)}
        >
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
              data-guide="workspace-folder-error"
              className="flex items-start gap-1 py-0.5 text-[10px] text-error"
              style={{ paddingLeft: 18 + childDepth * 10 }}
            >
              <WarningAlt
                size={12}
                className="mt-px shrink-0 text-warning"
                aria-hidden="true"
              />
              <span className="break-words">
                {t("workspace.folder_open_failed", {
                  name: node.entry.name || node.displayPath,
                })}
                {errorDetail ? `: ${errorDetail}` : null}
              </span>
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
  onCreateEntry,
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
  // A file manager selects more than one row: a shift-click picks a range, Ctrl
  // or Cmd toggles single rows. `selection` holds one entry per selected row —
  // everything a button needs about it — and `selected` is the single-row read
  // (rename, detach) that cannot mean anything for a set.
  const [selection, setSelection] = useState([]);
  const selected = selection.length === 1 ? selection[0] : null;
  const selectedKeys = useMemo(
    () => new Set(selection.map((item) => item.key)),
    [selection],
  );
  // The row a shift-click extends from: the last row clicked without a modifier.
  const anchorKeyRef = useRef(null);
  // Every rendered row by key, so a shift-click can select rows it never touched.
  const rowNodesRef = useRef(new Map());
  const listRef = useRef(null);
  const [detaching, setDetaching] = useState(false);
  // The row being dragged, the folder it is currently over, and whether a transfer
  // is running: a row moved by drag and drop goes through the same planner and
  // journal as every other workspace transfer.
  const [dragging, setDragging] = useState(null);
  const [dropKey, setDropKey] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Rows the agent just created or changed, by workspace path, until their dot fades.
  const [marks, setMarks] = useState({});
  const markTimersRef = useRef(new Map());
  const requestRef = useRef(0);
  const previewSeqRef = useRef(0);
  // `openFile` is defined below the description writer that uses it; the ref keeps
  // the writer from closing over an uninitialized const.
  const openFileRef = useRef(null);

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
    setSelection([]);
    anchorKeyRef.current = null;
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

  // --- drag and drop: moving a row onto a folder ----------------------------
  const providerForNode = (node) => {
    if (node.context) return node.context.provider;
    if (node.entry?.mount) {
      return providersRef.current.get(node.entry.mount.sourceId) ?? null;
    }
    return rootProvider;
  };

  const providerPathForNode = (node) =>
    node.context
      ? node.context.sourcePath
      : node.entry?.mount
        ? node.entry.mount.sourcePath
        : (node.entry?.path ?? "/");

  const entryForNode = (node) => ({
    sourceId: providerForNode(node)?.sourceId ?? node.entry?.sourceId,
    path: providerPathForNode(node),
    name: node.entry?.name ?? "",
    kind: node.entry?.kind === "dir" ? "dir" : "file",
    size: node.entry?.size,
    mime: node.entry?.mime,
  });

  // A folder row, a mount point and the open children below either are drop targets;
  // the synthetic /chats row and the display-only parents of a nested mount are not,
  // because neither stands for a directory a provider could write into.
  const dropTargetForNode = (node) => {
    if (!node || node.entry?.kind !== "dir") return null;
    if (!node.context && node.entry.local !== true && !node.entry.mount) {
      return null;
    }
    const provider = providerForNode(node);
    if (!provider) return null;
    const dir = providerPathForNode(node);
    if (!dir || readOnlyFor(node)) return null;
    return { provider, dir, displayDir: node.displayPath };
  };

  const rootDropTarget = rootProvider
    ? { provider: rootProvider, dir: "/", displayDir: "/" }
    : null;

  const isNoopDrop = (from, entry, target) =>
    from.sourceId === target.provider.sourceId &&
    joinPath(target.dir, entry.name) === normalizePath(entry.path);

  // A folder cannot be moved into itself or one of its own descendants.
  const isForbiddenDrop = (entry, target) =>
    entry.kind === "dir" && isWithinPath(target.dir, entry.path);

  const canDragNode = (node) => {
    if (!workspaceId || transferring || !node?.entry) return false;
    if (node.entry.mount) return false;
    // Only an entry of a real provider moves: mounts, `/chats` and the parents of a
    // nested mount belong to no folder that could give them up.
    if (!node.context && node.entry.local !== true) return false;
    return !readOnlyFor(node);
  };

  const labelForProvider = (provider) => {
    if (!provider) return "";
    const source = sourcesRef.current.find(
      (item) => item.id === provider.sourceId,
    );
    if (source?.label) return source.label;
    return provider === rootProvider
      ? t("workspace.workspace_root")
      : provider.sourceId;
  };

  // Shift-click selects a range, and dragging any of it carries the whole set:
  // one drop moves every selected row, the way a file manager does. Rows that a
  // provider would not give up (a mount, a read-only source) are left out.
  const dragItemsFor = (node) => {
    const info = describeNode(node);
    const selectedForDrag = selectedKeys.has(info.key)
      ? selection.filter((item) => item.writable && item.provider)
      : [];
    if (selectedForDrag.length > 1) {
      return selectedForDrag.map((item) => ({
        provider: item.provider,
        entry: {
          sourceId: item.provider.sourceId,
          path: item.sourcePath,
          name: item.name,
          kind: item.kind,
          size: item.size,
          mime: item.mime,
        },
      }));
    }
    const provider = providerForNode(node);
    return provider ? [{ provider, entry: entryForNode(node) }] : [];
  };

  const performMove = async (draggedItems, target) => {
    const to = target?.provider;
    const items = (draggedItems ?? []).filter(
      (item) => item?.provider && item?.entry,
    );
    if (!workspaceId || !to || items.length === 0) return;
    // A row dropped on the folder it already lives in has nowhere to go.
    const movable = items.filter(
      (item) => !isNoopDrop(item.provider, item.entry, target),
    );
    if (movable.length === 0) return;
    if (movable.some((item) => isForbiddenDrop(item.entry, target))) {
      setActionError(t("workspace.transfer_blocked"));
      return;
    }
    setActionError("");
    try {
      for (const item of movable) {
        if (item.provider.status !== "connected") await item.provider.connect();
      }
      if (to.status !== "connected") await to.connect();
      // Never merge into, or silently rename over, something already there: a drag
      // that lands on an occupied name is reported instead of guessed at.
      const conflicts = [];
      for (const item of movable) {
        const targetPath = joinPath(target.dir, item.entry.name);
        try {
          await to.stat(targetPath);
          conflicts.push(item.entry.name);
        } catch (reason) {
          if (!(reason instanceof WorkspaceError && reason.code === "NOT_FOUND")) {
            throw reason;
          }
        }
      }
      if (conflicts.length === 1) {
        setActionError(
          t("workspace.transfer_conflict", { name: conflicts[0] }),
        );
        return;
      }
      if (conflicts.length > 1) {
        setActionError(
          t("workspace.transfer_conflict_many", { count: conflicts.length }),
        );
        return;
      }
      const from = movable[0].provider;
      const plan = planTransfer({
        intent: "auto",
        sameSource: movable.every(
          (item) => item.provider.sourceId === to.sourceId,
        ),
        sourceKind: from.kind,
        targetKind: to.kind,
        entries: movable.map((item) => item.entry),
        // A batch has one folder-to-its-own-descendant check per row, done above,
        // so the planner's single-path check is not given a path to trip over.
        sourcePath: "",
        targetPath: "",
        sourceCapabilities: from.capabilities ?? {},
        targetCapabilities: to.capabilities ?? {},
      });
      if (plan.blocked) {
        setActionError(plan.warnings[0] || t("workspace.transfer_blocked"));
        return;
      }
      const run = async () => {
        setTransferring(true);
        const failures = [];
        const movedKeys = new Set();
        try {
          for (const item of movable) {
            const targetPath = joinPath(target.dir, item.entry.name);
            try {
              await runTransfer({
                workspaceId,
                from: item.provider,
                to,
                entry: item.entry,
                // A folder lands as target/name/**, a file as target/name.
                targetDir:
                  item.entry.kind === "dir" ? targetPath : target.dir,
                strategy: "move",
              });
              movedKeys.add(`${item.provider.sourceId}:${item.entry.path}`);
              // The same change feed the agent's writes use: every open folder
              // re-lists and the moved row is marked as new where it landed.
              notifyWorkspaceFilesChanged(workspaceId, {
                path: joinPath(target.displayDir, item.entry.name),
                kind: "create",
              });
            } catch (reason) {
              failures.push(`${item.entry.name}: ${errorMessage(reason)}`);
            }
          }
        } finally {
          setTransferring(false);
        }
        // A row that moved is not here any more, so it leaves the selection; a
        // failed one stays selected for a second attempt.
        setSelection((current) =>
          current.filter(
            (item) =>
              !movedKeys.has(`${item.provider?.sourceId}:${item.sourcePath}`),
          ),
        );
        setActionError(failures.join(" · "));
      };
      if (plan.requiresConfirmation) {
        openModal("workspaceTransfer", {
          plan,
          fromLabel:
            movable.length > 1 &&
            new Set(movable.map((item) => item.provider.sourceId)).size > 1
              ? t("workspace.transfer_multiple_sources")
              : labelForProvider(from),
          toLabel: labelForProvider(to),
          onConfirm: () => {
            // The confirmed transfer runs after the dialog closed, so a failure
            // lands in the tree's own error line.
            void run();
          },
        });
        return;
      }
      await run();
    } catch (reason) {
      setActionError(errorMessage(reason));
    }
  };

  const dropDragged = (target) => {
    const dragged = dragging;
    setDragging(null);
    setDropKey(null);
    if (dragged && target) void performMove(dragged.items, target);
  };

  const dragStartNode = (node, event) => {
    if (!canDragNode(node)) return;
    const items = dragItemsFor(node);
    if (items.length === 0) return;
    setActionError("");
    setDragging({ items });
    event.dataTransfer?.setData(
      WORKSPACE_DRAG_TYPE,
      JSON.stringify({
        sourceId: items[0].provider.sourceId,
        entry: items[0].entry,
        entries: items.map((item) => item.entry),
      }),
    );
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  };

  // A selected folder cannot receive the set it belongs to.
  const dropsOntoDraggedEntry = (target) =>
    Boolean(dragging) &&
    dragging.items.some(
      (item) =>
        item.provider.sourceId === target.provider.sourceId &&
        normalizePath(item.entry.path) === normalizePath(target.dir),
    );

  const dragOverNode = (node, event) => {
    if (!dragging) return;
    const target = dropTargetForNode(node);
    if (!target) return;
    if (dropsOntoDraggedEntry(target)) return;
    const movable = dragging.items.filter(
      (item) => !isNoopDrop(item.provider, item.entry, target),
    );
    // Every row of the set must be able to land here, or the drop is refused.
    const accepts =
      movable.length > 0 &&
      movable.every((item) => !isForbiddenDrop(item.entry, target));
    if (!accepts) return;
    event.preventDefault();
    // The folder wins over the list behind it, which is the workspace root.
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    setDropKey(nodeKey(node));
  };

  const dragLeaveNode = (node, event) => {
    if (event?.currentTarget?.contains?.(event.relatedTarget)) return;
    setDropKey((current) => (current === nodeKey(node) ? null : current));
  };

  const dropOnNode = (node, event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = dropTargetForNode(node);
    if (!target || dropsOntoDraggedEntry(target)) return;
    dropDragged(target);
  };

  const dragOverRoot = (event) => {
    if (!dragging || !rootDropTarget) return;
    const accepts = dragging.items.some(
      (item) => !isNoopDrop(item.provider, item.entry, rootDropTarget),
    );
    if (!accepts) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    setDropKey(ROOT_DROP_KEY);
  };

  const dragLeaveRoot = (event) => {
    if (event?.currentTarget?.contains?.(event.relatedTarget)) return;
    setDropKey((current) => (current === ROOT_DROP_KEY ? null : current));
  };

  const dropOnRoot = (event) => {
    if (!dragging) return;
    event.preventDefault();
    dropDragged(rootDropTarget);
  };

  // The root row is a drop target of its own: the list background below the rows
  // also moves to the root, but a listing that fills the pane leaves no background
  // to hit. Stopping the event keeps the list handler from dropping twice.
  const rootRowDragOver = (event) => {
    dragOverRoot(event);
    event.stopPropagation();
  };
  const rootRowDragLeave = (event) => {
    dragLeaveRoot(event);
    event.stopPropagation();
  };
  const rootRowDrop = (event) => {
    dropOnRoot(event);
    event.stopPropagation();
  };

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
    // hold mounts, so uploads and new entries must never target them. With no
    // folder to write into, the toolbar falls back to the workspace root — the
    // browser's own storage, never whatever mount was last clicked.
    if (!node.context && !node.entry.local && !node.entry.mount) {
      setTarget(rootTarget());
      return;
    }
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
  }, [rootTarget]);

  // Every row can be selected, whether or not it is an upload target: the
  // selection is what the rename, detach, download and delete buttons act on.
  // What a row is — its provider, its path there, what may be done to it — is
  // read once here and carried with the selection, so a button never has to
  // resolve it again.
  const describeNode = useCallback(
    (node) => {
      // Only a row that is itself mounted into the workspace can be detached —
      // a file inside a mounted folder belongs to that folder's source.
      const mount = node.entry?.mount ?? null;
      const context = node.context ?? null;
      const provider = context
        ? context.provider
        : mount
          ? (providersRef.current.get(mount.sourceId) ?? null)
          : rootProvider;
      // A rename is in place, so the row needs an entry of its own in a
      // provider: the synthetic /chats folder and the parents of nested mounts
      // are display-only, and a mount point stands for someone else's folder.
      // Delete follows the same rule; a mount is detached instead.
      const ownEntry = Boolean(context) || node.entry?.local === true;
      const writable =
        Boolean(provider) && !mount && ownEntry && !readOnlyFor(node);
      const kind = node.entry?.kind === "dir" ? "dir" : "file";
      const renamable = writable && provider.capabilities?.rename === true;
      const deletable = writable && provider.capabilities?.delete === true;
      // A file's bytes can always be saved when the provider can read them: a
      // read-only source still lets you take a copy out.
      const downloadable =
        Boolean(provider) &&
        kind === "file" &&
        provider.capabilities?.read === true;
      return {
        key: nodeKey(node),
        mount: mount ?? null,
        provider,
        sourcePath: context
          ? context.sourcePath
          : (mount?.sourcePath ?? node.displayPath),
        displayPath: node.displayPath,
        name: node.entry?.name ?? "",
        kind,
        mime: node.entry?.mime,
        size: node.entry?.size,
        writable,
        renamable,
        deletable,
        downloadable,
      };
    },
    [readOnlyFor, rootProvider],
  );

  // The keys of the rows as they are painted, top to bottom: a folder comes
  // before the children it holds, exactly as they are rendered. That order is
  // what a shift-click selects along, and the DOM already knows it.
  const visibleRowKeys = () => {
    const list = listRef.current;
    if (!list) return [];
    return Array.from(list.querySelectorAll("[data-row-key]")).map(
      (element) => element.getAttribute("data-row-key") ?? "",
    );
  };

  const selectNode = useCallback(
    (node, event) => {
      setActionError("");
      const info = describeNode(node);
      // Shift grows the selection from the row clicked last; Ctrl/Cmd toggles one
      // row in and out of it. Neither opens anything, unlike a plain click.
      const extending = Boolean(event?.shiftKey);
      const toggling = Boolean(event?.metaKey || event?.ctrlKey);
      if (extending) {
        const keys = visibleRowKeys();
        const from = keys.indexOf(anchorKeyRef.current ?? "");
        const to = keys.indexOf(info.key);
        if (from === -1 || to === -1) {
          setSelection([info]);
          anchorKeyRef.current = info.key;
        } else {
          const [start, end] = from <= to ? [from, to] : [to, from];
          const range = [];
          for (const key of keys.slice(start, end + 1)) {
            const rangeNode = rowNodesRef.current.get(key);
            if (rangeNode) range.push(describeNode(rangeNode));
          }
          setSelection(range.length ? range : [info]);
        }
      } else if (toggling) {
        setSelection((current) =>
          current.some((item) => item.key === info.key)
            ? current.filter((item) => item.key !== info.key)
            : [...current, info],
        );
        anchorKeyRef.current = info.key;
      } else {
        setSelection([info]);
        anchorKeyRef.current = info.key;
      }
      // A file is not a place to put a file: the toolbar drops back to the root,
      // which is the workspace's own browser storage.
      if (node.entry?.kind !== "dir") setTarget(rootTarget());
    },
    [describeNode, rootTarget],
  );

  // Folders (and their rows) come and go with every listing, so each rendered
  // row registers itself: a shift-click has to reach rows nobody has clicked.
  const registerRow = useCallback((key, node) => {
    rowNodesRef.current.set(key, node);
  }, []);
  const unregisterRow = useCallback((key) => {
    rowNodesRef.current.delete(key);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection([]);
    anchorKeyRef.current = null;
  }, []);

  // A rename keeps the entry where it is and only changes its name. The dialog is
  // the shared entry modal, so the name rules (no slashes) are the same as for a
  // new file; a host dialog owns the nested instance for the same reason
  // `createEntry` does.
  const renameSelection = () => {
    const current = selected;
    if (!current?.renamable) return;
    const folder = parentPath(current.displayPath);
    const request = {
      kind: current.kind,
      path: folder,
      initialName: current.name,
      titleKey: "workspace.rename_entry",
      confirmKey: "common.rename",
      introKey: "workspace.rename_in",
      onCreate: async (name) => {
        const provider = current.provider;
        if (!provider) throw new Error("Source is not available");
        if (name === current.name) return;
        await provider.connect();
        await renameProviderEntry(provider, current.sourcePath, name);
        setSelection([]);
        anchorKeyRef.current = null;
        // Re-list through the change feed, which also marks the new row.
        notifyWorkspaceFilesChanged(workspaceId, {
          path: joinPath(folder, name),
          kind: "create",
        });
      },
    };
    if (onCreateEntry) {
      onCreateEntry(request);
      return;
    }
    openModal("workspaceCreateEntry", request);
  };

  // Save every selected file to the user's disk. A single file is an ordinary
  // browser download. A set asks once for a destination folder: the browser's
  // download dialog cannot take one, so the files go through the File System
  // Access API, one at a time and without overwriting anything. Where that API
  // is missing (an insecure page, an older browser), every file is downloaded
  // on its own instead.
  const downloadSelection = async () => {
    const files = selection.filter(
      (item) => item.downloadable && item.kind === "file" && item.provider,
    );
    if (files.length === 0) return;
    setActionError("");
    const items = files.map((file) => ({
      provider: file.provider,
      entry: {
        name: file.name,
        path: file.sourcePath,
        kind: "file",
        size: file.size,
        mime: file.mime,
      },
    }));

    if (items.length > 1 && canPickDownloadDirectory()) {
      let directory = null;
      try {
        directory = await pickDownloadDirectory();
      } catch (reason) {
        setActionError(errorMessage(reason));
        return;
      }
      // A cancelled picker leaves the files alone: it must not fall back to
      // dropping them somewhere the user did not choose.
      if (!directory) return;
      setDownloading(true);
      try {
        const failures = await saveProviderEntriesToDirectory(directory, items);
        if (failures.length) {
          setActionError(
            failures.map((item) => `${item.name}: ${item.message}`).join(" · "),
          );
        }
      } finally {
        setDownloading(false);
      }
      return;
    }

    const failures = [];
    for (const { provider, entry } of items) {
      try {
        await downloadProviderEntry(provider, entry);
      } catch (reason) {
        failures.push(`${entry.name}: ${errorMessage(reason)}`);
      }
    }
    if (failures.length) setActionError(failures.join(" · "));
  };

  // Deleting is the one destructive action here, so it always asks first: the
  // confirmation is the shared dialog, never a "don't show this again" switch.
  // A set is deleted one row after another, and the rows that failed stay
  // selected so a second attempt is one click.
  const deleteSelection = () => {
    const items = selection.filter((item) => item.deletable && item.provider);
    if (items.length === 0) return;
    const multiple = items.length > 1;
    openModal("confirmAction", {
      messageKey: multiple
        ? "workspace.delete_selection_confirm"
        : items[0].kind === "dir"
          ? "workspace.delete_folder_confirm"
          : "workspace.delete_file_confirm",
      messageValues: multiple
        ? { count: items.length }
        : { name: items[0].name },
      confirmKey: "common.delete",
      danger: true,
      showDontShowAgain: false,
      onConfirm: () => {
        void (async () => {
          const failures = [];
          const failed = [];
          let targetGone = false;
          for (const item of items) {
            try {
              const provider = item.provider;
              if (provider.status !== "connected") await provider.connect();
              await provider.remove(item.sourcePath, {
                recursive: item.kind === "dir",
              });
              // A folder that was the upload target is gone: the toolbar must
              // not keep writing into it.
              if (
                item.kind === "dir" &&
                (target.path === item.displayPath ||
                  target.path.startsWith(`${item.displayPath}/`))
              ) {
                targetGone = true;
              }
              // Re-list every open folder through the change feed, no mark.
              notifyWorkspaceFilesChanged(workspaceId, {
                path: item.displayPath,
                kind: "remove",
              });
            } catch (reason) {
              failed.push(item);
              failures.push(`${item.name}: ${errorMessage(reason)}`);
            }
          }
          setSelection(failed);
          if (failed.length === 0) anchorKeyRef.current = null;
          if (targetGone) setTarget(rootTarget());
          setActionError(failures.join(" · "));
        })();
      },
    });
  };

  const detachSelection = async () => {
    const mount = selected?.mount;
    if (!workspaceId || !mount || detaching) return;
    setDetaching(true);
    setActionError("");
    try {
      await removeWorkspaceMount(workspaceId, mount.id);
      setSelection([]);
      anchorKeyRef.current = null;
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
      // An image preview offers "Describe": the description is `<name>-description.md`
      // beside the image. Any provider can tell whether it is already there and open
      // it; only a writable one can create it.
      const descriptionTarget = (fileName) =>
        joinPath(parentPath(sourcePath), fileName);
      const openDescription = (fileName, size) => {
        const target = descriptionTarget(fileName);
        const descriptionNode = {
          entry: {
            ...node.entry,
            path: target,
            name: fileName,
            kind: "file",
            mime: "text/markdown",
            size,
          },
          context: node.context
            ? { ...node.context, sourcePath: target }
            : null,
          displayPath: joinPath(parentPath(node.displayPath), fileName),
        };
        setSelection([describeNode(descriptionNode)]);
        anchorKeyRef.current = nodeKey(descriptionNode);
        openFileRef.current?.(descriptionNode);
        return target;
      };
      const descriptionExists = async (fileName) => {
        try {
          if (provider.status !== "connected") await provider.connect();
          await provider.stat(descriptionTarget(fileName));
          return true;
        } catch {
          return false;
        }
      };
      const saveDescription =
        !readOnlyFor(node) && provider.capabilities?.write === true
          ? async (text, fileName) => {
              if (provider.status !== "connected") await provider.connect();
              const target = descriptionTarget(fileName);
              const data = new TextEncoder().encode(text);
              await provider.write(target, streamOf(data), {
                size: data.byteLength,
                overwrite: true,
              });
              notifyWorkspaceFilesChanged(workspaceId, {
                path: target,
                kind: "create",
              });
              // Leave the image and show its description, selected, so the result
              // is what the user is looking at.
              return openDescription(fileName, data.byteLength);
            }
          : undefined;
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
        if ("error" in result) {
          onPreview(result);
        } else {
          onPreview({
            ...result,
            descriptionExists,
            openDescription,
            ...(saveDescription ? { saveDescription } : {}),
          });
        }
      } catch (reason) {
        if (sequence !== previewSeqRef.current) return;
        onPreview({ entry, error: errorMessage(reason) });
      }
    },
    [onPreview, rootProvider, readOnlyFor, workspaceId, describeNode],
  );

  useEffect(() => {
    openFileRef.current = openFile;
  }, [openFile]);

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
    const request = {
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
    };
    // A dialog that hosts this tree owns the nested dialog: opening the global
    // one would replace that host and with it the draft it holds.
    if (onCreateEntry) {
      onCreateEntry(request);
      return;
    }
    openModal("workspaceCreateEntry", request);
  };

  const api = {
    isSelected: (node) => selectedKeys.has(nodeKey(node)),
    revision: rootRevision,
    markFor: (node) => marks[node.displayPath] ?? null,
    isExpanded: (node) => expandedSet(workspaceId).has(nodeKey(node)),
    setExpanded: (node, value) => {
      const set = expandedSet(workspaceId);
      if (value) set.add(nodeKey(node));
      else set.delete(nodeKey(node));
    },
    canDrag: canDragNode,
    isDropTarget: (node) => dropKey === nodeKey(node),
    onDragStart: dragStartNode,
    onDragEnd: () => {
      setDragging(null);
      setDropKey(null);
    },
    onDragOverNode: dragOverNode,
    onDragLeaveNode: dragLeaveNode,
    onDropNode: dropOnNode,
    badgeFor,
    labelFor,
    loadChildren,
    registerRow,
    unregisterRow,
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
            {selection.length > 1 && (
              <div className="flex shrink-0 items-center gap-0.5">
                <span
                  data-guide="workspace-selected-count"
                  className="whitespace-nowrap text-[10px] text-base-content/60"
                >
                  {t("workspace.selected_count", { count: selection.length })}
                </span>
                <button
                  type="button"
                  data-guide="workspace-clear-selection"
                  onClick={clearSelection}
                  title={t("workspace.clear_selection")}
                  aria-label={t("workspace.clear_selection")}
                  className="btn btn-ghost btn-xs btn-square"
                >
                  <Close size={14} />
                </button>
              </div>
            )}
            {selected?.renamable && (
              <button
                type="button"
                data-guide="workspace-rename"
                onClick={renameSelection}
                title={t("workspace.rename_entry")}
                className="btn btn-ghost btn-xs shrink-0 gap-1"
              >
                <Edit size={14} />
                <span className="truncate">{t("common.rename")}</span>
              </button>
            )}
            {selection.some((item) => item.downloadable) && (
              <button
                type="button"
                data-guide="workspace-download"
                onClick={() => void downloadSelection()}
                title={t("workspace.download")}
                className="btn btn-ghost btn-xs shrink-0 gap-1"
              >
                <Download size={14} />
                <span className="truncate">{t("workspace.download")}</span>
              </button>
            )}
            {selection.length > 0 &&
              selection.every((item) => item.deletable && item.provider) && (
              <button
                type="button"
                data-guide="workspace-delete"
                onClick={deleteSelection}
                title={t("common.delete")}
                className="btn btn-ghost btn-xs shrink-0 gap-1 text-error"
              >
                <TrashCan size={14} />
                <span className="truncate">{t("common.delete")}</span>
              </button>
            )}
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
        {transferring && (
          <div className="px-3 py-1 text-[10px] text-base-content/60">
            {t("workspace.transferring")}
          </div>
        )}
        {downloading && (
          <div className="px-3 py-1 text-[10px] text-base-content/60">
            {t("workspace.downloading")}
          </div>
        )}
        <div
          ref={listRef}
          data-guide="workspace-files"
          className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 py-1 ${
            dragging && dropKey === ROOT_DROP_KEY
              ? "ring-1 ring-inset ring-primary"
              : ""
          }`}
          onDragOver={dragOverRoot}
          onDragLeave={dragLeaveRoot}
          onDrop={dropOnRoot}
          onClick={(event) => {
            // A click on the empty part of the list drops the wash; a click inside a
            // row is that row's business.
            if (event.target.closest('[data-guide="workspace-row"]')) return;
            clearSelection();
            setTarget(rootTarget());
          }}
        >
          {showLoading && (
            <div className="px-2 py-1 text-[10px] text-base-content/40">
              {t("common.loading")}
            </div>
          )}
          {!showLoading && (
            <div
              data-guide="workspace-root-row"
              title={t("workspace.workspace_root")}
              onClick={(event) => {
                // Selecting the root is not a row operation; it only points the
                // New file/folder and upload actions back at the workspace root.
                event.stopPropagation();
                clearSelection();
                setTarget(rootTarget());
              }}
              onDragOver={rootRowDragOver}
              onDragLeave={rootRowDragLeave}
              onDrop={rootRowDrop}
              className={`flex cursor-pointer items-center gap-1 rounded px-1 text-[11px] ${
                dragging && dropKey === ROOT_DROP_KEY
                  ? "bg-accent/15 ring-1 ring-inset ring-primary"
                  : "hover:bg-base-200/70"
              }`}
              style={{ paddingLeft: 4 }}
            >
              <Folder size={13} className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate font-mono text-base-content">
                /
              </span>
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
