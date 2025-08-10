import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function ShareSettingsModal({
  isOpen,
  onClose,
  arcana,
  exportArcana,
  dontShowAgain,
  setLocalState,
  isArcanaSupported,
  handleShareSettings
}) {
  // Handler for "Don't Show Again" checkbox
  const handleCheckboxChange = (event) => {
    setLocalState((prevState) => ({
      ...prevState,
      exportOptions: {
        ...prevState.exportOptions,
        dontShowAgainShare: event.target.checked,
      },
    }));
  };

  // Handler for "Export Arcana" checkbox
  const handleCheckboxChangeArcana = (event) => {
    setLocalState((prevState) => ({
      ...prevState,
      exportOptions: {
        ...prevState.exportOptions,
        exportArcana: event.target.checked,
      },
    }));
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="description.help_title">
      {/* Intro Text */}
      <div className="pt-0 pb-2">
        <p className="dark:text-white text-black text-justify text-sm">
          <Trans i18nKey="description.exportSettings1" />
        </p>
      </div>

      {/* Arcana Export Option */}
      {arcana?.id && (
        <>
          <div>
            <p className="text-red-600">
              <Trans i18nKey="description.arcana_warn" />
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="exportArcana"
              checked={exportArcana}
              onChange={handleCheckboxChangeArcana}
              className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${
                !arcana.id ? "bg-gray-400 cursor-not-allowed" : ""
              }`}
              disabled={!arcana.id || !isArcanaSupported}
            />
            <label
              htmlFor="exportArcana"
              className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
            >
              <Trans i18nKey="description.exportArcana" />
            </label>
          </div>
        </>
      )}

      {/* "Don't Show Again" Option */}
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

      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row gap-2 justify-end w-full mt-4">
        <button
          className="text-white p-3 bg-green-600 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
          onClick={handleShareSettings}
        >
          <Trans i18nKey="description.exportSettings2" />
        </button>
      </div>
    </BaseModal>
  );
}