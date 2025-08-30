import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function ClearMessagesModal({
  isOpen,
  onClose,
  localState,
  setLocalState,
  // dontShowAgain,
  clearMessages,
}) {
  // Handler for checkbox state change
  const handleCheckboxChange = (event) => {
    setLocalState((prev) => ({
      ...prev,
      dontShow: {
        ...prev?.dontShow,
        clearMessages: event.target.checked,
      },
    }));
  };

  const dontShowAgain = localState?.dontShow?.clearMessages;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="description.help_title1"
    >
      {/* Message */}
      <div className="pt-0 pb-2">
        <p className="dark:text-white text-black text-justify text-sm">
          <Trans i18nKey="description.history" />
        </p>
      </div>

      {/* Checkbox */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="dontShowAgain"
          checked={dontShowAgain}
          onChange={handleCheckboxChange}
          className="h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out"
        />
        <label
          htmlFor="dontShowAgain"
          className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
        >
          <Trans i18nKey="description.dont_show_again" />
        </label>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm mt-4">
        {/* Cancel button */}
        <button
          className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
          onClick={onClose}
        >
          <Trans i18nKey="description.cache2" />
        </button>

        {/* Clear history button */}
        <button
          className="text-white p-3 bg-red-600 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
          onClick={() => {clearMessages(); onClose();}}
        >
          <Trans i18nKey="description.cache3" />
        </button>
      </div>
    </BaseModal>
  );
}