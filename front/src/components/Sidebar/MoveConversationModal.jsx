import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import BaseModal from "../../modals/BaseModal";
import { assignConversationToFolder, ensureFolder, getFolder } from "../../db";

const UNSORTED_FOLDER = "__unsorted__";

export default function MoveConversationModal({
  isOpen,
  onClose,
  conversationId,
  conversationTitle,
  currentFolderId = null,
  folders = [],
  localState,
  setLocalState,
}) {
  const { t } = useTranslation();
  const [selectedFolder, setSelectedFolder] = useState(
    currentFolderId ?? UNSORTED_FOLDER
  );
  const [availableFolders, setAvailableFolders] = useState(folders ?? []);
  const [newFolderName, setNewFolderName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setAvailableFolders(folders ?? []);
  }, [folders]);

  useEffect(() => {
    setSelectedFolder(currentFolderId ?? UNSORTED_FOLDER);
    setError("");
    setNewFolderName("");
  }, [currentFolderId, isOpen]);

  const folderOptions = useMemo(() => {
    const list = [...(availableFolders || [])];
    return list.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [availableFolders]);

  const handleMove = async () => {
    setError("");
    try {
      const target =
        selectedFolder === UNSORTED_FOLDER ? null : selectedFolder;
      await assignConversationToFolder(conversationId, target);
      if (localState?.id === conversationId && typeof setLocalState === "function") {
        setLocalState((prev) => ({
          ...prev,
          folderId: target,
          flush: true,
        }));
      }
      onClose();
    } catch (err) {
      setError(err?.message ?? t("folders.error_generic"));
    }
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setError(t("folders.error_required"));
      return;
    }
    setCreating(true);
    setError("");
    try {
      const newId = await ensureFolder(trimmed);
      if (!newId) {
        setError(t("folders.error_generic"));
      } else {
        const row = await getFolder(newId);
        if (row) {
          setAvailableFolders((prev) => {
            const exists = prev?.some((folder) => folder.id === row.id);
            if (exists) return prev;
            return [...prev, row];
          });
        }
        setSelectedFolder(newId);
        setNewFolderName("");
      }
    } catch (err) {
      setError(err?.message ?? t("folders.error_generic"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="folders.move_title"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-sm text-gray-800 dark:text-gray-100">
        <p className="text-gray-700 dark:text-gray-200">
          <Trans
            i18nKey="folders.move_description"
            values={{ title: conversationTitle || "" }}
          />
        </p>
        <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
          <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40">
            <input
              type="radio"
              className="text-tertiary focus:ring-tertiary"
              checked={selectedFolder === UNSORTED_FOLDER}
              onChange={() => setSelectedFolder(UNSORTED_FOLDER)}
            />
            <span className="text-sm">
              <Trans i18nKey="folders.uncategorized" />
            </span>
          </label>
          {folderOptions?.map((folder) => (
            <label
              key={folder.id}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40"
            >
              <input
                type="radio"
                className="text-tertiary focus:ring-tertiary"
                checked={selectedFolder === folder.id}
                onChange={() => setSelectedFolder(folder.id)}
              />
              <span className="text-sm">{folder.name}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            <Trans i18nKey="folders.new_folder_prompt" />
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => {
                setNewFolderName(e.target.value);
                if (error) setError("");
              }}
              className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg_dark px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-tertiary/40"
              placeholder={t("folders.name_placeholder")}
            />
            <button
              className="cursor-pointer px-3 py-2 rounded-xl border border-tertiary text-tertiary hover:bg-tertiary/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleCreateFolder}
              disabled={creating}
            >
              <Trans i18nKey="folders.create_inline" />
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            className="cursor-pointer px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            onClick={onClose}
          >
            <Trans i18nKey="common.cancel" />
          </button>
          <button
            className="cursor-pointer px-5 py-2 rounded-lg bg-tertiary text-white hover:bg-tertiary/90 transition shadow disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleMove}
            disabled={!conversationId}
          >
            <Trans i18nKey="folders.move_action" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
