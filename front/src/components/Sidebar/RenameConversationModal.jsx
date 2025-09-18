import { useState, useEffect, useRef } from "react";
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
  const inputRef = useRef(null);

  // const dispatch = useDispatch();
  const { t } = useTranslation();

  useEffect(() => {
    setTitle(currentTitle || "");
    setError(""); // Clear error when modal reopens
  }, [currentTitle]);

  // Autofocus the input when modal opens
  useEffect(() => {
    if (isOpen) {
      const focusInput = () => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Set cursor to the end of the text
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
          return true;
        }
        return false;
      };

      // Try focusing immediately first
      if (!focusInput()) {
        // If immediate focus fails, try with increasing delays
        const timeouts = [50, 150, 300];

        timeouts.forEach((delay) => {
          setTimeout(() => {
            focusInput();
          }, delay);
        });
      }
    }
  }, [isOpen]);

  const handleRename = async () => {
    if (!title?.trim()) {
      setError(t("rename_conversation.alert_empty"));
      return;
    }
    if (!localState) return;
    if (localState?.id !== id) {
      await updateConversationMeta(id, {
        title: title.trim(),
      });
    } else {
      setLocalState((prev) => ({
        ...prev,
        title: title.trim(),
        flush: true,
      }));
      onClose();
    }
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
      titleKey="rename_conversation.title"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4">
        {/* Input Field */}
        <div className="flex flex-col gap-1">
          <input
            ref={inputRef}
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
            placeholder={t("rename_conversation.enter_name")}
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
            {t("common.cancel")}
          </button>

          <button
            className="cursor-pointer p-3 bg-tertiary text-white rounded-2xl
                     hover:bg-tertiary/90 min-w-[100px]
                     select-none shadow-lg dark:shadow-dark"
            onClick={handleRename}
          >
            <Trans i18nKey="common.rename" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
