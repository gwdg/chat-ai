import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import BaseModal from "../BaseModal";

// Large paste area for one radiology input (previous report, dictation or
// assessment). The text is passed on exactly as entered.
export default function ReportInputModal({
  isOpen,
  onClose,
  kind,
  initialText = "",
  onConfirm,
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  const isEmpty = text.trim() === "";

  const handleConfirm = () => {
    if (isEmpty) return;
    onConfirm(text);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey={`radiology.modal_title.${kind}`}
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col gap-3">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleConfirm();
            }
          }}
          spellCheck={false}
          placeholder={t("radiology.paste_placeholder")}
          className="w-full h-[60vh] p-3 text-sm font-sans resize-none border dark:border-border_dark rounded-lg
                   bg-white dark:bg-black text-black dark:text-white
                   focus:outline-none focus:ring-2 focus:ring-tertiary"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <Trans i18nKey="radiology.verbatim_hint" />
        </p>
        <div className="flex justify-end gap-3 w-full">
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
                     select-none shadow-lg dark:shadow-dark
                     disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={isEmpty}
            onClick={handleConfirm}
          >
            {t("common.ok")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
