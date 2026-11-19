import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import AddSourceModal from "../../modals/Workspace/AddSourceModal";
import CreateEntryModal from "../../modals/Workspace/CreateEntryModal";
import WorkspaceRootBrowser from "./WorkspaceRootBrowser";
import WorkspaceSourceBrowser from "./WorkspaceSourceBrowser";
import WorkspaceSourcesPanel from "./WorkspaceSourcesPanel";
import { useWorkspaceMounts, useWorkspaceSources } from "../../db/workspaceDb";
import { addSelectionToWorkspace } from "../../workspace/addSelectionToWorkspace";
import { chatFolderLabel } from "../../workspace/chatFolderName";
import { listWorkspaceRoot } from "../../workspace/listWorkspaceRoot";
import { createWorkspaceRootProvider } from "../../workspace/workspaceRoot";
import { joinPath } from "../../workspace/paths";
import { uploadLocalFiles } from "../../workspace/upload";
import { useConversationList } from "../../db";

const errorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

export default function WorkspaceStorageManager({ workspaceId }) {
  const { t } = useTranslation();

  const [target, setTarget] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addProgress, setAddProgress] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const [rootPath, setRootPath] = useState("/");
  const [rootEntries, setRootEntries] = useState([]);
  const [rootLoading, setRootLoading] = useState(false);
  const [rootError, setRootError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [entryKind, setEntryKind] = useState(false);

  const sources = useWorkspaceSources(workspaceId ?? undefined);
  const mounts = useWorkspaceMounts(workspaceId ?? undefined);
  const conversations = useConversationList() || [];
  const rootProvider = useMemo(
    () => (workspaceId ? createWorkspaceRootProvider(workspaceId) : null),
    [workspaceId],
  );

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

  useEffect(() => {
    if (workspaceId) return;
    setTarget(null);
    setAdding(false);
    setAddProgress(null);
    setAddOpen(false);
    setRootPath("/");
    setRootEntries([]);
    setRootError("");
    setEntryKind(false);
  }, [workspaceId]);

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
        workspaceId,
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
  }, [rootProvider, workspaceId, rootPath, mountsKey]);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot]);

  const entryBadge = (entry) => {
    if (entry.local) return t("workspace.storage_badge_browser");
    const exact = mounts.find((mount) => mount.path === entry.path);
    const mount =
      exact ??
      mounts
        .filter(
          (candidate) =>
            entry.path === candidate.path ||
            entry.path.startsWith(
              `${candidate.path.replace(/\/+$/, "")}/`,
            ),
        )
        .sort((a, b) => b.path.length - a.path.length)[0];
    if (!mount) return undefined;
    const source = sources.find((item) => item.id === mount.sourceId);
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
        return t("workspace.storage_badge_browser");
      default:
        return undefined;
    }
  };

  const addSelection = async (selection) => {
    if (!workspaceId || selection.length === 0) return;
    setAdding(true);
    setAddProgress({ done: 0, total: selection.length });
    try {
      await addSelectionToWorkspace(workspaceId, selection, {
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

  return (
    <>
      <div
        data-testid="workspace-storage-manager"
        className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row"
      >
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
          <div
            data-testid="create-workspace-path"
            className="truncate border-b border-base-300 px-3 py-1.5 text-[11px] text-base-content/55"
            title={rootPath}
          >
            {rootPath}
          </div>

          <WorkspaceRootBrowser
            path={rootPath}
            rootPath="/"
            breadcrumbs={[]}
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
            entryBadge={entryBadge}
            displayName={(entry) =>
              chatFolderLabel(entry.path, { sources, conversations })
            }
            emptyHint={t("workspace.root_empty_hint")}
          />
        </section>
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
        workspaceId={workspaceId}
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
    </>
  );
}
