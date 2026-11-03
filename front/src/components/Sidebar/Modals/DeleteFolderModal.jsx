import { Trans } from "react-i18next";
import BaseModal from "../../../modals/BaseModal";
import { deleteFolder } from "../../../db";

export default function DeleteFolderModal({
  isOpen,
  onClose,
  folderId,
  folderName,
}) {
  const handleDelete = async () => {
    if (!folderId) return;
    await deleteFolder(folderId);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="folders.delete_title"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-sm">
        <p className="text-base-content">
          <Trans
            i18nKey="folders.delete_description"
            values={{ name: folderName || "" }}
          />
        </p>
        <div className="flex flex-col md:flex-row gap-2 justify-end">
          <button
            className="btn"
            onClick={onClose}
          >
            <Trans i18nKey="common.cancel" />
          </button>
          <button
            className="btn btn-error"
            onClick={handleDelete}
          >
            <Trans i18nKey="common.delete" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
