import { useState } from "react";
import { useTranslation } from "react-i18next";

import WorkspaceSourceBrowser from "./WorkspaceSourceBrowser";
import WorkspaceSourcesPanel from "./WorkspaceSourcesPanel";
import WorkspaceStorageTree from "./WorkspaceStorageTree";
import { useWorkspaceSources } from "../../db/workspaceDb";
import { useModal } from "../../modals/ModalContext";
import { addSelectionToWorkspace } from "../../workspace/addSelectionToWorkspace";
import { addLocalSource, pickDirectory } from "../../workspace/localWorkspace";

export default function WorkspaceStorageManager({ workspaceId, onOpenAddSource }) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const [target, setTarget] = useState(null);
  const [adding, setAdding] = useState(false);
  const [addProgress, setAddProgress] = useState(null);
  const sources = useWorkspaceSources(workspaceId ?? undefined);

  const addSelection = async (selection) => {
    if (!workspaceId || selection.length === 0) return;
    setAdding(true);
    setAddProgress({ done: 0, total: selection.length });
    try {
      await addSelectionToWorkspace(workspaceId, selection, {
        onProgress: (done, total) => setAddProgress({ done, total }),
      });
    } finally {
      setAdding(false);
      setAddProgress(null);
    }
  };

  // Inside the create-workspace dialog the caller owns the nested dialog: opening the global
  // modal there would replace the create dialog and its draft workspace.
  const openAdd = (kind) =>
    onOpenAddSource
      ? onOpenAddSource(kind)
      : openModal("workspaceAddSource", {
          workspaceId,
          initialKind: kind,
        });

  // A folder dropped on the device pane already arrives as a directory handle, so it mounts
  // straight away instead of opening the dialog. A drop only grants read access, which the
  // provider asks to widen when the folder is first written to.
  const mountDroppedFolder = async (handle) => {
    if (!workspaceId) return;
    try {
      await handle.requestPermission?.({ mode: "readwrite" });
    } catch {
      // The handle stays readable; writing asks for permission again when it is needed.
    }
    await addLocalSource({ workspaceId, handle });
  };

  // Clicking the device pane's empty state goes straight to the folder picker: no second dialog,
  // which would replace the create-workspace dialog it was opened from.
  const pickDeviceFolder = async () => {
    if (!workspaceId) return "";
    try {
      const handle = await pickDirectory({
        mode: "readwrite",
        insecureMessage: t("workspace.local_insecure"),
        unsupportedMessage: t("workspace.local_unsupported"),
      });
      await addLocalSource({ workspaceId, handle });
      return "";
    } catch (error) {
      if (error && error.name === "AbortError") return "";
      return error instanceof Error ? error.message : String(error);
    }
  };

  return (
    <div
      data-testid="workspace-storage-manager"
      className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row"
    >
      <section
        data-testid="create-workspace-sources"
        className="flex min-h-[60vh] min-w-0 flex-[3] flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 md:min-h-0 md:flex-row"
      >
        <aside className="w-full shrink-0 px-1.5 md:w-64 md:overflow-y-auto md:border-r md:border-base-300 md:[&>section]:rounded-none md:[&>section]:border-0 md:[&>section]:bg-transparent">
          <WorkspaceSourcesPanel
            sources={sources}
            activeTarget={target}
            onOpenTarget={setTarget}
            onAddSource={() => openAdd()}
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
            onMountDeviceFolder={mountDroppedFolder}
            onPickDeviceFolder={pickDeviceFolder}
            embedded
            className="min-h-0 flex-1"
          />
        </div>
      </section>

      <WorkspaceStorageTree
        workspaceId={workspaceId}
        className="min-h-[60vh] min-w-0 flex-[2] rounded-xl border border-base-300 bg-base-100 md:min-h-0"
      />
    </div>
  );
}
