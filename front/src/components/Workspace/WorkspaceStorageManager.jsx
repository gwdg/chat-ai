import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import WorkspaceSourceBrowser from "./WorkspaceSourceBrowser";
import WorkspaceSourcesPanel from "./WorkspaceSourcesPanel";
import WorkspaceStorageTree from "./WorkspaceStorageTree";
import {
  detachWorkspaceChat,
  ensureSaiaFsSource,
  removeWorkspaceMount,
  unmountLocalFolder,
  useAllWorkspaceChats,
  useAllWorkspaceMounts,
  useDeviceLocalSources,
  useWorkspaceChats,
  useWorkspaceMounts,
  useWorkspaceSources,
} from "../../db/workspaceDb";
import { useModal } from "../../modals/ModalContext";
import { useSaiaFsAccess, SAIA_FS_AVAILABLE } from "../../hooks/useSaiaFsAccess";
import { addSelectionToWorkspace } from "../../workspace/addSelectionToWorkspace";
import {
  addLocalSourceToWorkspace,
  pickDirectory,
} from "../../workspace/localWorkspace";

export default function WorkspaceStorageManager({
  workspaceId,
  onOpenAddSource,
  allowDetach = false,
}) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  // Both dialogs open on Your Device: it is where a folder is picked from, so the
  // browser pane starts on the device drive instead of an empty prompt.
  const [target, setTarget] = useState({ drive: "device" });
  const [adding, setAdding] = useState(false);
  const [addProgress, setAddProgress] = useState(null);
  const saiaFsAccess = useSaiaFsAccess();
  const workspaceSources = useWorkspaceSources(workspaceId ?? undefined);

  // The SAIA filesystem is per account, not per workspace, so every workspace gets one source
  // for it — but only while the service answers its health probe, which is an async answer.
  // `useSaiaFsAccess` fails closed: an unreachable or absent service leaves the source out
  // instead of adding a row that cannot connect. The row is never removed again, so a source
  // whose service went away keeps its mounts and reports its own error.
  useEffect(() => {
    if (!workspaceId || saiaFsAccess !== SAIA_FS_AVAILABLE) return;
    void ensureSaiaFsSource(workspaceId);
  }, [workspaceId, saiaFsAccess]);
  // "Your Device" lists every folder this browser has been granted, not only the
  // ones already mounted in this workspace.
  const deviceSources = useDeviceLocalSources(workspaceId ?? undefined);
  const sources = useMemo(() => {
    const ids = new Set(workspaceSources.map((source) => source.id));
    return [
      ...workspaceSources,
      ...deviceSources.filter((source) => !ids.has(source.id)),
    ];
  }, [workspaceSources, deviceSources]);

  const mounts = useWorkspaceMounts(workspaceId ?? undefined);
  const workspaceChats = useWorkspaceChats(workspaceId ?? undefined);
  const everyMount = useAllWorkspaceMounts();
  const everyChat = useAllWorkspaceChats();

  // An item is "in the workspace" when this workspace holds a mount for exactly
  // that folder — a folder mounted in another workspace is still addable here.
  const isInWorkspace = useCallback(
    (selection) => {
      if (!workspaceId) return false;
      if (selection.sourceKind === "chat") {
        return workspaceChats.some(
          (chat) => chat.conversationId === selection.conversationId,
        );
      }
      return mounts.some(
        (mount) =>
          mount.sourceId === selection.sourceId &&
          mount.sourcePath === selection.path,
      );
    },
    [workspaceId, mounts, workspaceChats],
  );

  // A mount covers everything under its source path, so selecting a file inside a
  // mounted folder unmounts the folder that brought it in.
  const mountCovers = (mount, item) =>
    mount.sourceId === item.sourceId &&
    (mount.sourcePath === "/" ||
      mount.sourcePath === item.path ||
      item.path.startsWith(`${mount.sourcePath}/`));

  // Your Device lists folders from every workspace, so Unmount has to see every
  // mount — a folder mounted in another workspace is still mounted. A device
  // folder can always be unmounted: it is listed because Chat AI holds it, so
  // forgetting it is exactly what takes it off the list.
  const isMounted = useCallback(
    (selection) => {
      if (selection.sourceKind === "chat") {
        return everyChat.some(
          (chat) => chat.conversationId === selection.conversationId,
        );
      }
      if (selection.sourceKind === "local") return true;
      return everyMount.some((mount) => mountCovers(mount, selection));
    },
    [everyMount, everyChat],
  );

  // Unmounting is "stop using this folder": a device folder loses its row in
  // every workspace, its stored permission and its mounts, so it leaves the
  // list. The folder itself is untouched on disk and can be added again.
  const unmountSelection = async (selection) => {
    if (selection.length === 0) return;
    for (const item of selection) {
      if (item.sourceKind === "chat" && item.conversationId) {
        for (const chat of everyChat) {
          if (chat.conversationId === item.conversationId) {
            await detachWorkspaceChat(chat.workspaceId, chat.conversationId);
          }
        }
        continue;
      }
      if (item.sourceKind === "local") {
        await unmountLocalFolder(item.sourceId);
        continue;
      }
      for (const mount of everyMount) {
        if (mountCovers(mount, item)) {
          await removeWorkspaceMount(mount.workspaceId, mount.id);
        }
      }
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
    await addLocalSourceToWorkspace({ workspaceId, handle });
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
      await addLocalSourceToWorkspace({ workspaceId, handle });
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
            onUnmountSelection={unmountSelection}
            isInWorkspace={isInWorkspace}
            isMounted={isMounted}
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
        allowDetach={allowDetach}
        className="min-h-[60vh] min-w-0 flex-[2] rounded-xl border border-base-300 bg-base-100 md:min-h-0"
      />
    </div>
  );
}
