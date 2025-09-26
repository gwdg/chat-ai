// components/modals/ConfigureArcanaModal.jsx
import { useState, useEffect } from "react";
import BaseModal from "../BaseModal";
import { Trans } from "react-i18next";

export default function ConfigureArcanaModal({
  isOpen,
  onClose,
  initialValue = "",
  onSave,
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => setValue(initialValue), [initialValue]);

  const handleSave = () => {
    onSave?.(value.trim());
    onClose?.();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="Arcana">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <Trans i18nKey="modal.arcana_desc">
            Enter the Arcana ID (e.g., <code>jkunkel1/hpc-docs</code>).
          </Trans>
        </p>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. jkunkel1/hpc-docs"
          className="dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-3 border dark:border-border_dark outline-none rounded-lg shadow-sm w-full"
        />
        <div className="flex flex-col md:flex-row gap-2 pt-2 justify-center w-full">
          <button
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl md:w-fit border w-full min-w-[150px] select-none cursor-pointer"
            onClick={handleSave}
          >
            <Trans i18nKey="common.save">Save</Trans>
          </button>
          <button
            className="text-primary dark:text-tertiary p-3 md:w-fit w-full min-w-[150px] select-none cursor-pointer"
            onClick={onClose}
          >
            <Trans i18nKey="common.cancel">Cancel</Trans>
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
