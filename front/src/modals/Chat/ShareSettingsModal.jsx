import { useState } from "react";
import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function ShareSettingsModal({
  isOpen,
  onClose,
  localState,
  setLocalState,
  handleShareSettings
}) {

  const isArcanaSupported = localState.settings?.enable_tools || localState.settings?.arcana?.id;
  const [shareArcana, setShareArcana] = useState(false);
  // Handler for "Don't Show Again" checkbox
  // const handleCheckboxChange = (event) => {
  //   setLocalState((prevState) => ({
  //     ...prevState,
  //     exportOptions: {
  //       ...prevState.exportOptions,
  //       dontShowAgainShare: event.target.checked,
  //     },
  //   }));
  // };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="common.notice"
    >
      {/* Intro Text */}
      <div className="pt-0 pb-2">
        <p className="dark:text-white text-black text-justify text-sm">
          <Trans i18nKey="share_settings.description" />
        </p>
      </div>

      {/* Arcana Export Option */}
      {localState?.settings?.arcana?.id && (
        <div className="flex flex-col gap-1">
          {/* Warning when sharing arcana */}
          {shareArcana && ( 
              <div>
              <p className="text-red-600 text-sm">
                <Trans i18nKey="share_settings.warn_arcana" />
              </p>
              </div>
            )}
          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-2 justify-between w-full mt-4">
            {/* Include arcana details checkbox */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="exportArcana"
                checked={shareArcana}
                onChange={() => {setShareArcana(!shareArcana)}}
                className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${
                  !localState?.settings?.arcana?.id ? "bg-gray-400 cursor-not-allowed" : ""
                }`}
                disabled={!localState?.settings?.arcana?.id || !isArcanaSupported}
              />
              <label
                htmlFor="exportArcana"
                className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
              >
                <Trans i18nKey="export_conversation.export_arcana" />
              </label>
            </div>
            {/* Share settings button */}
            <button
              className="text-white p-3 bg-green-600 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
              onClick={() => handleShareSettings(shareArcana)}
            >
              <Trans i18nKey="common.share" />
            </button>
          </div>
        </div>
      )}
    </BaseModal>
  );
}