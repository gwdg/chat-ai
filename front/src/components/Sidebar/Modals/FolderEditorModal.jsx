import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import BaseModal from "../../../modals/BaseModal";
import {
  createFolder,
  renameFolder,
  setFolderColor,
  setFolderIcon,
} from "../../../db";
import { TOPIC_COLORS } from "../topicColors";
import { DEFAULT_TOPIC_ICON, TOPIC_ICONS } from "../topicIcons";

export default function FolderEditorModal({
  isOpen,
  onClose,
  mode = "create",
  folderId = null,
  initialName = "",
  initialColor = null,
  initialIcon = null,
}) {
  const isRename = mode === "rename";
  const { t } = useTranslation();
  const [name, setName] = useState(initialName || "");
  const [colorId, setColorId] = useState(initialColor || TOPIC_COLORS[0].id);
  const [iconId, setIconId] = useState(initialIcon || DEFAULT_TOPIC_ICON.id);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName || "");
      setColorId(initialColor || TOPIC_COLORS[0].id);
      setIconId(initialIcon || DEFAULT_TOPIC_ICON.id);
      setError("");
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      });
    }
  }, [initialName, initialColor, initialIcon, isOpen]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("folders.error_required"));
      return;
    }
    try {
      if (isRename && folderId) {
        await renameFolder(folderId, trimmed);
        await setFolderColor(folderId, colorId);
        await setFolderIcon(folderId, iconId);
      } else {
        await createFolder(trimmed, { color: colorId, icon: iconId });
      }
      onClose();
    } catch (err) {
      setError(err?.message ?? t("folders.error_generic"));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
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
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={handleKeyDown}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg_dark px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-tertiary/40"
            placeholder={t("folders.name_placeholder")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-300">
            <Trans i18nKey="folders.choose_color" />
          </span>
          <div className="flex flex-wrap gap-2">
            {TOPIC_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                onClick={() => setColorId(color.id)}
                aria-label={color.label}
                aria-pressed={colorId === color.id}
                className={`h-6 w-6 cursor-pointer rounded-full transition ${
                  colorId === color.id
                    ? "ring-2 ring-offset-2 ring-tertiary dark:ring-offset-bg_dark"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-300">
            <Trans i18nKey="folders.choose_icon" />
          </span>
          <div className="grid grid-cols-7 gap-1">
            {TOPIC_ICONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setIconId(id)}
                title={label}
                aria-label={label}
                aria-pressed={iconId === id}
                className={`flex cursor-pointer items-center justify-center rounded-lg p-2 transition ${
                  iconId === id
                    ? "bg-gray-100 dark:bg-gray-700 text-black dark:text-white"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
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
