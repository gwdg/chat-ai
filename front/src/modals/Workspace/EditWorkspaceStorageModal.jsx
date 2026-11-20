import { useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import AddSourceModal from "./AddSourceModal";
import WorkspaceStorageManager from "../../components/Workspace/WorkspaceStorageManager";

/**
 * The storage half of the create-workspace dialog, for a workspace that already
 * exists. It is the same `WorkspaceStorageManager` that dialog renders, so the
 * sources rail, the browsers and the root tree behave identically; everything is
 * written as it is picked, which is why the dialog only needs a Close button.
 *
 * "Add source" is a nested dialog owned here rather than the global
 * `workspaceAddSource` modal: the global one replaces this dialog, which would
 * unmount the manager mid-edit.
 */
export default function EditWorkspaceStorageModal({
  isOpen,
  onClose,
  workspaceId,
  workspaceName = "",
}) {
  const { t } = useTranslation();
  const [addSourceKind, setAddSourceKind] = useState(null);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="workspace.edit_storage"
      maxWidth="max-w-[min(1280px,95vw)]"
      contentClassName="flex h-[min(78vh,720px)] flex-col gap-2 p-5 pt-0 overflow-y-auto md:overflow-hidden"
    >
      <p
        data-testid="edit-workspace-storage-hint"
        className="shrink-0 text-xs leading-relaxed text-base-content/60"
      >
        {workspaceName
          ? t("workspace.edit_storage_hint", { name: workspaceName })
          : t("workspace.edit_storage_hint_no_name")}
      </p>

      <div className="flex min-h-0 flex-1 flex-col">
        <WorkspaceStorageManager
          workspaceId={workspaceId}
          onOpenAddSource={(kind) => setAddSourceKind(kind ?? "local")}
        />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        <button
          type="button"
          data-testid="edit-workspace-storage-close"
          className="btn"
          onClick={onClose}
        >
          {t("common.close")}
        </button>
      </div>

      {addSourceKind && (
        <AddSourceModal
          isOpen
          onClose={() => setAddSourceKind(null)}
          workspaceId={workspaceId}
          initialKind={addSourceKind}
        />
      )}
    </BaseModal>
  );
}
