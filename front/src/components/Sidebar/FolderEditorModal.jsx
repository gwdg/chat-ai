import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import BaseModal from "../../modals/BaseModal";
import { createFolder, renameFolder } from "../../db";

export default function FolderEditorModal({
  isOpen,
  onClose,
  mode = "create",
  folderId = null,
  initialName = "",
}) {
  const isRename = mode === "rename";
  const { t } = useTranslation();
  const [name, setName] = useState(initialName || "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(initialName || "");
      setError("");
    }
  }, [initialName, isOpen]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("folders.error_required"));
      return;
    }
    try {
      if (isRename && folderId) {
        await renameFolder(folderId, trimmed);
      } else {
        await createFolder(trimmed);
      }
      onClose();
    } catch (err) {
      setError(err?.message ?? t("folders.error_generic"));
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey={isRename ? "folders.rename_title" : "folders.create_title"}
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-300">
            <Trans i18nKey="folders.name_label" />
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg_dark px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-tertiary/40"
            placeholder={t("folders.name_placeholder")}
          />
        </div>
        {error && (
          <p className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 text-sm">
          <button
            className="cursor-pointer px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            onClick={onClose}
          >
            <Trans i18nKey="common.cancel" />
          </button>
          <button
            className="cursor-pointer px-5 py-2 rounded-lg bg-tertiary text-white hover:bg-tertiary/90 transition shadow"
            onClick={handleSubmit}
          >
            <Trans i18nKey={isRename ? "common.save" : "common.create"} />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
