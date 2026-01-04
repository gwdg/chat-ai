import { Trans } from "react-i18next";
import BaseModal from "../../modals/BaseModal";
import { deleteFolder } from "../../db";

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
        <p className="text-gray-700 dark:text-gray-200">
          <Trans
            i18nKey="folders.delete_description"
            values={{ name: folderName || "" }}
          />
        </p>
        <div className="flex flex-col md:flex-row gap-2 justify-end">
          <button
            className="cursor-pointer px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            onClick={onClose}
          >
            <Trans i18nKey="common.cancel" />
          </button>
          <button
            className="cursor-pointer px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition shadow"
            onClick={handleDelete}
          >
            <Trans i18nKey="common.delete" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
