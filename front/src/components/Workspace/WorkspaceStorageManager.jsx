import { useState } from "react";

import WorkspaceSourceBrowser from "./WorkspaceSourceBrowser";
import WorkspaceSourcesPanel from "./WorkspaceSourcesPanel";
import WorkspaceStorageTree from "./WorkspaceStorageTree";
import { useWorkspaceSources } from "../../db/workspaceDb";
import { useModal } from "../../modals/ModalContext";
import { addSelectionToWorkspace } from "../../workspace/addSelectionToWorkspace";

export default function WorkspaceStorageManager({ workspaceId }) {
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

  const openAdd = (kind) =>
    openModal("workspaceAddSource", {
      workspaceId,
      initialKind: kind,
    });

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

      <WorkspaceStorageTree
        workspaceId={workspaceId}
        className="min-h-[60vh] min-w-0 flex-[2] rounded-xl border border-base-300 bg-base-100 md:min-h-0"
      />
    </div>
  );
}
