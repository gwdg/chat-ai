import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { Trans, useTranslation } from "react-i18next";
import BaseModal from "../../modals/BaseModal";
import { updateConversationMeta } from "../../db";

export default function RenameConversationModal({
  id,
  currentTitle,
  isOpen,
  onClose,
  localState,
  setLocalState,
}) {
  const [title, setTitle] = useState(currentTitle || "");
  const [error, setError] = useState("");

  // const dispatch = useDispatch();
  const { t } = useTranslation();

  useEffect(() => {
    setTitle(title);
    setError(""); // Clear error when modal reopens
  }, [title]);

  const handleRename = async () => {
    if (!title?.trim()) {
      setError(t("description.error_title"));
      return;
    }
    const lastModified = await updateConversationMeta(id, {
      title: title.trim(),
    });
    if (!localState) return;
    localState.lastModified = lastModified;
    // Optional for speed - change conversations locally
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleRename();
      e.preventDefault();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    if (error) setError("");
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="description.rename_conversation"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4">
        {/* Input Field */}
        <div className="flex flex-col gap-1">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleKeyDown}
            className={`w-full p-2 border ${
              error ? "border-red-500" : "dark:border-border_dark"
            } rounded-lg 
                   bg-white dark:bg-black text-black dark:text-white
                   focus:outline-none focus:ring-2 ${
                     error ? "focus:ring-red-500" : "focus:ring-tertiary"
                   }`}
            placeholder={t("description.input_conversation")}
            autoFocus
          />
          {error && <p className="text-red-500 text-sm pl-1">{error}</p>}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 w-full pt-2">
          <button
            className="cursor-pointer p-3 border dark:border-border_dark rounded-2xl
                     text-black dark:text-white bg-gray-100 dark:bg-gray-800
                     hover:bg-gray-200 dark:hover:bg-gray-700
                     min-w-[100px] select-none"
            onClick={onClose}
          >
            {t("Cancel", "Cancel")}
          </button>

          <button
            className="cursor-pointer p-3 bg-tertiary text-white rounded-2xl
                     hover:bg-tertiary/90 min-w-[100px]
                     select-none shadow-lg dark:shadow-dark"
            onClick={handleRename}
          >
            <Trans i18nKey="description.input_button" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
