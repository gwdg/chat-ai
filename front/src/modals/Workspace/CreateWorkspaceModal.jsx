import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Pencil } from "lucide-react";

import BaseModal from "../BaseModal";
import AddSourceModal from "./AddSourceModal";
import CreateEntryModal from "./CreateEntryModal";
import WorkspaceRootBrowser from "../../components/Workspace/WorkspaceRootBrowser";
import WorkspaceAgentPanel from "../../components/Workspace/WorkspaceAgentPanel";
import WorkspaceSourceBrowser from "../../components/Workspace/WorkspaceSourceBrowser";
import WorkspaceSourcesPanel from "../../components/Workspace/WorkspaceSourcesPanel";
import {
  createWorkspace,
  deleteWorkspace,
  updateWorkspace,
  useWorkspaceList,
  useWorkspaceMounts,
  useWorkspaceSources,
} from "../../db/workspaceDb";
import { addSelectionToWorkspace } from "../../workspace/addSelectionToWorkspace";
import { listWorkspaceRoot } from "../../workspace/listWorkspaceRoot";
import { createWorkspaceRootProvider } from "../../workspace/workspaceRoot";
import { joinPath, normalizePath } from "../../workspace/paths";
import { uploadLocalFiles } from "../../workspace/upload";
import {
  TOPIC_ICONS,
  topicIconById,
} from "../../components/Sidebar/topicIcons";
import {
  TOPIC_COLORS,
  topicColorById,
  withAlpha,
} from "../../components/Sidebar/topicColors";

const DEFAULT_WORKSPACE_ICON = "rocket";

const rootTabClass = (active) =>
  `whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${
    active
      ? "bg-base-200 text-base-content"
      : "text-base-content/55 hover:text-base-content"
  } disabled:opacity-40 disabled:hover:text-base-content/55`;

const errorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

const placeholderName = (workspaces, base) => {
  const used = new Set(
    workspaces.map((workspace) => workspace.name.trim().toLowerCase()),
  );
  if (!used.has(base.toLowerCase())) return base;
  let index = 2;
  while (used.has(`${base} ${index}`.toLowerCase())) index += 1;
  return `${base} ${index}`;
};

export default function CreateWorkspaceModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const workspaces = useWorkspaceList();

  const [draftId, setDraftId] = useState(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_WORKSPACE_ICON);
  const [color, setColor] = useState(TOPIC_COLORS[0].id);
  const [iconOpen, setIconOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [target, setTarget] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addProgress, setAddProgress] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const [rootPath, setRootPath] = useState("/");
  const [rootEntries, setRootEntries] = useState([]);
  const [rootLoading, setRootLoading] = useState(false);
  const [rootError, setRootError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [rootTab, setRootTab] = useState("root");
  const [entryKind, setEntryKind] = useState(false);

  const sources = useWorkspaceSources(draftId ?? undefined);
  const mounts = useWorkspaceMounts(draftId ?? undefined);
  const rootProvider = useMemo(
    () => (draftId ? createWorkspaceRootProvider(draftId) : null),
    [draftId],
  );

  const draftIdRef = useRef(null);
  const startedRef = useRef(false);
  const settledRef = useRef(false);
  const sessionRef = useRef(0);
  const pendingPatchRef = useRef({});
  const uploadInputRef = useRef(null);
  const mountsRef = useRef(mounts);
  mountsRef.current = mounts;
  const mountsKey = useMemo(
    () =>
      mounts
        .map((mount) => `${mount.id}:${mount.sourceId}:${mount.path}`)
        .join("|"),
    [mounts],
  );

  // The draft row exists while the modal is open, so every panel below reads
  // the real workspace data; one effect starts it exactly once per open.
  useEffect(() => {
    if (!isOpen) {
      startedRef.current = false;
      sessionRef.current += 1;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    settledRef.current = false;
    const session = sessionRef.current;
    const placeholder = placeholderName(
      workspaces,
      t("workspace.new_workspace"),
    );
    createWorkspace(placeholder)
      .then((id) => {
        if (sessionRef.current !== session) {
          void deleteWorkspace(id);
          return;
        }
        draftIdRef.current = id;
        setDraftId(id);
        const pending = pendingPatchRef.current;
        pendingPatchRef.current = {};
        if (pending.icon) void updateWorkspace(id, { icon: pending.icon });
        if (pending.color) void updateWorkspace(id, { color: pending.color });
      })
      .catch((event) => {
        setError(
          errorMessage(event).includes("already exists")
            ? t("workspace.name_taken")
            : t("workspace.create_error"),
        );
      });
  }, [isOpen, workspaces, t]);

  const resetDraftState = () => {
    setName("");
    setIcon(DEFAULT_WORKSPACE_ICON);
    setColor(TOPIC_COLORS[0].id);
    setIconOpen(false);
    setError("");
    setTarget(null);
    setAdding(false);
    setAddProgress(null);
    setAddOpen(false);
    setRootPath("/");
    setRootEntries([]);
    setRootError("");
    setRootTab("root");
    setEntryKind(false);
  };

  const cancel = async () => {
    if (settledRef.current) return;
    settledRef.current = true;
    sessionRef.current += 1;
    const id = draftIdRef.current;
    draftIdRef.current = null;
    setDraftId(null);
    if (id) {
      try {
        await deleteWorkspace(id);
      } catch {
        // A failed cleanup must not keep the dialog open.
      }
    }
    resetDraftState();
    onClose();
  };

  const create = async () => {
    const id = draftIdRef.current;
    if (busy || !id || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await updateWorkspace(id, { name: name.trim() });
      settledRef.current = true;
      draftIdRef.current = null;
      onClose();
      navigate(`/workspace/${id}`);
    } catch (event) {
      setError(
        errorMessage(event).includes("already exists")
          ? t("workspace.name_taken")
          : errorMessage(event).includes("required")
            ? t("workspace.name_required")
            : t("workspace.create_error"),
      );
    } finally {
      setBusy(false);
    }
  };

  const chooseIcon = (id) => {
    setIcon(id);
    setIconOpen(false);
    const draft = draftIdRef.current;
    if (draft) void updateWorkspace(draft, { icon: id });
    else pendingPatchRef.current.icon = id;
  };

  const chooseColor = (id) => {
    setColor(id);
    const draft = draftIdRef.current;
    if (draft) void updateWorkspace(draft, { color: id });
    else pendingPatchRef.current.color = id;
  };

  const loadRoot = useCallback(async () => {
    if (!rootProvider) {
      setRootEntries([]);
      setRootLoading(false);
      setRootError("");
      return;
    }
    setRootLoading(true);
    setRootError("");
    try {
      const entries = await listWorkspaceRoot({
        rootProvider,
        workspaceId: draftId,
        mounts: mountsRef.current,
        path: rootPath,
      });
      setRootEntries(entries);
    } catch (event) {
      setRootError(errorMessage(event));
      setRootEntries([]);
    } finally {
      setRootLoading(false);
    }
    // mountsKey stands in for the mount list so a re-created array does not
    // reload the tree on every render.
  }, [rootProvider, draftId, rootPath, mountsKey]);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot]);

  const breadcrumbs = useMemo(() => {
    const parts = normalizePath(rootPath).split("/").filter(Boolean);
    const items = [{ label: t("workspace.root"), path: "/" }];
    let path = "/";
    for (const part of parts) {
      path = joinPath(path, part);
      items.push({ label: part, path });
    }
    return items;
  }, [rootPath, t]);

  const addSelection = async (selection) => {
    const id = draftIdRef.current;
    if (!id || selection.length === 0) return;
    setAdding(true);
    setAddProgress({ done: 0, total: selection.length });
    try {
      await addSelectionToWorkspace(id, selection, {
        onProgress: (done, total) => setAddProgress({ done, total }),
      });
      await loadRoot();
    } finally {
      setAdding(false);
      setAddProgress(null);
    }
  };

  const handleSourceAdded = () => {
    setAddOpen(false);
    void loadRoot();
  };

  const openAdd = (kind) => setAddOpen(kind ?? null);

  const triggerUpload = () => uploadInputRef.current?.click();

  const uploadFiles = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!rootProvider || files.length === 0) return;
    setUploading(true);
    try {
      await rootProvider.connect();
      await uploadLocalFiles(rootProvider, rootPath, files, (file, uploadError) =>
        setRootError(`${file.name}: ${errorMessage(uploadError)}`),
      );
      await loadRoot();
    } finally {
      setUploading(false);
    }
  };

  const createRootEntry = async (entryName) => {
    if (!rootProvider) return;
    await rootProvider.connect();
    const path = joinPath(rootPath, entryName);
    if (entryKind === "dir") {
      await rootProvider.mkdir(path);
    } else {
      await rootProvider.write(
        path,
        new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        { size: 0, overwrite: false },
      );
    }
    await loadRoot();
  };

  const SelectedIcon = topicIconById(icon).Icon;
  const selectedColor = topicColorById(color);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={cancel}
      titleKey="workspace.create_title"
      maxWidth="max-w-[min(1280px,95vw)]"
      contentClassName="flex h-[min(78vh,720px)] flex-col gap-2 p-5 pt-0 overflow-y-auto md:overflow-hidden"
    >
      <div className="flex shrink-0 items-start gap-3 rounded-xl border border-base-300 bg-base-100 px-3 py-2">
        <div className="relative shrink-0">
          <button
            type="button"
            data-testid="create-workspace-icon"
            onClick={() => setIconOpen((open) => !open)}
            aria-label={t("folders.choose_icon")}
            aria-expanded={iconOpen}
            title={t("folders.choose_icon")}
            className="group relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition hover:brightness-95"
            style={{
              backgroundColor: withAlpha(selectedColor.hex, 0.16),
              color: selectedColor.hex,
            }}
          >
            <SelectedIcon size={24} />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-base-content/5 opacity-0 transition group-hover:opacity-100">
              <Pencil size={14} />
            </span>
          </button>
          {iconOpen && (
            <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 grid max-h-56 w-72 grid-cols-8 gap-1 overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-1 shadow-lg">
              {TOPIC_ICONS.map((item) => {
                const Icon = item.Icon;
                const selected = icon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`create-workspace-icon-${item.id}`}
                    onClick={() => chooseIcon(item.id)}
                    aria-pressed={selected}
                    title={item.label}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                      selected
                        ? "bg-accent text-accent-content"
                        : "bg-base-200 text-base-content/65 hover:bg-base-300"
                    }`}
                  >
                    <Icon size={15} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("workspace.name_label")}
            aria-label={t("workspace.name_label")}
            className="w-full max-w-[32rem] border-b border-transparent bg-transparent px-0 text-lg font-semibold text-base-content outline-none placeholder:text-base-content/40 focus:border-accent"
            autoFocus
          />
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="min-w-0 text-[11px] text-base-content/60">
              {t("workspace.subtitle")}
            </p>
            <div
              role="group"
              aria-label={t("folders.choose_color")}
              className="flex shrink-0 items-center gap-1.5"
            >
              {TOPIC_COLORS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  data-testid={`create-workspace-color-${option.id}`}
                  onClick={() => chooseColor(option.id)}
                  aria-label={option.label}
                  aria-pressed={color === option.id}
                  title={option.label}
                  className={`h-4 w-4 rounded-full transition ${
                    color === option.id
                      ? "ring-2 ring-accent ring-offset-2 ring-offset-base-100"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: option.hex }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row">
        <section
          data-testid="create-workspace-sources"
          className="flex min-h-[60vh] min-w-0 flex-[3] flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 md:min-h-0 md:flex-row"
        >
          <aside className="w-full shrink-0 p-1.5 md:w-64 md:overflow-y-auto md:border-r md:border-base-300 md:[&>section]:rounded-none md:[&>section]:border-0 md:[&>section]:bg-transparent">
            <WorkspaceSourcesPanel
              sources={sources}
              activeTarget={target}
              onOpenTarget={setTarget}
              onAddSource={() => openAdd(null)}
              onAddDeviceFolder={() => openAdd("local")}
            />
          </aside>
          <div
            data-testid="create-workspace-browser"
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <WorkspaceSourceBrowser
              sources={sources}
              target={target}
              onTargetChange={setTarget}
              onAddToWorkspace={addSelection}
              busy={adding}
              onAddDeviceFolder={() => openAdd("local")}
              embedded
              className="min-h-0 flex-1"
            />
          </div>
        </section>

        <section
          data-testid="create-workspace-root"
          className="flex min-h-[60vh] min-w-0 flex-[2] flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 md:min-h-0"
        >
          <div className="flex items-center gap-2 border-b border-base-300 px-2 py-1.5">
            <div role="tablist" className="flex min-w-0 items-center gap-0.5">
              <button
                type="button"
                role="tab"
                aria-selected={rootTab === "root"}
                onClick={() => setRootTab("root")}
                className={rootTabClass(rootTab === "root")}
              >
                {t("workspace.workspace_root")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rootTab === "preview"}
                disabled
                className={rootTabClass(rootTab === "preview")}
              >
                {t("workspace.tab_preview")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rootTab === "agents"}
                onClick={() => setRootTab("agents")}
                className={rootTabClass(rootTab === "agents")}
              >
                {t("workspace.tab_agents")}
              </button>
            </div>
            {rootTab === "root" && (
              <span className="ml-auto min-w-0 truncate text-[10px] text-base-content/50">
                {rootPath}
              </span>
            )}
          </div>

          {rootTab === "agents" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <WorkspaceAgentPanel workspaceId={draftId} framed={false} />
            </div>
          ) : (
            <WorkspaceRootBrowser
              path={rootPath}
              rootPath="/"
              breadcrumbs={breadcrumbs}
              entries={rootEntries}
              loading={rootLoading}
              error={rootError}
              onNavigate={setRootPath}
              onRetry={() => void loadRoot()}
              onOpen={(entry) => {
                if (entry.mount) {
                  setTarget({ drive: "device", sourceId: entry.mount.sourceId });
                  return;
                }
                if (entry.kind === "dir") setRootPath(entry.path);
              }}
              onUpload={triggerUpload}
              uploading={uploading}
              onNewFolder={() => setEntryKind("dir")}
              onNewFile={() => setEntryKind("file")}
              onAddFolder={() => openAdd(null)}
              onRefresh={() => void loadRoot()}
              emptyHint={t("workspace.root_empty_hint")}
            />
          )}
        </section>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        {error ? (
          <p
            data-testid="create-workspace-error"
            className="mr-auto text-xs text-error"
          >
            {error}
          </p>
        ) : (
          addProgress && (
            <p className="mr-auto text-[11px] text-base-content/60">
              {t("workspace.source_browser.adding_progress", addProgress)}
            </p>
          )
        )}
        <button type="button" className="btn" onClick={cancel} disabled={busy}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          data-testid="create-workspace-create"
          className="btn btn-accent"
          onClick={create}
          disabled={!name.trim() || busy || !draftId}
        >
          {busy ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              {t("workspace.create_applying")}
            </>
          ) : (
            t("workspace.create_workspace")
          )}
        </button>
      </div>

      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={uploadFiles}
      />
      <AddSourceModal
        isOpen={addOpen !== false}
        onClose={() => setAddOpen(false)}
        workspaceId={draftId}
        initialKind={addOpen === null ? undefined : addOpen}
        onAdded={handleSourceAdded}
      />
      <CreateEntryModal
        isOpen={entryKind !== false}
        onClose={() => setEntryKind(false)}
        kind={entryKind || "file"}
        path={rootPath}
        onCreate={createRootEntry}
      />
    </BaseModal>
  );
}
