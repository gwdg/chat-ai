import { useState } from "react";
import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function ShareSettingsModal({
  isOpen,
  onClose,
  handleShareSettings,
  showArcanaOption = false,
  showMcpServersOption = false,
}) {
  const [shareArcana, setShareArcana] = useState(false);
  const [shareMcpServers, setShareMcpServers] = useState(false);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="common.notice"
    >
      {/* Intro Text */}
      <p className="dark:text-white text-black text-justify text-sm">
        <Trans i18nKey="share_settings.description" />
      </p>

      {/* Warnings when sharing sensitive details */}
      {(shareArcana || shareMcpServers) && (
        <div className="mt-2 space-y-2">
          {shareArcana && (
            <p className="bg-red-600/50 rounded-lg p-2 text-white text-sm">
              <Trans i18nKey="share_settings.warn_arcana" />
            </p>
          )}
          {shareMcpServers && (
            <p className="bg-red-600/50 rounded-lg p-2 text-white text-sm">
              <Trans i18nKey="share_settings.warn_mcp" />
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row gap-2 justify-between items-center w-full mt-2">
        {/* Share options */}
        <div>
          {(showArcanaOption || showMcpServersOption) && (
            <div className="flex flex-col gap-2">
              {showArcanaOption && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="exportArcana"
                    checked={shareArcana}
                    onChange={() => {
                      setShareArcana(!shareArcana);
                    }}
                    className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${
                      !showArcanaOption ? "bg-gray-400 cursor-not-allowed" : ""
                    }`}
                    disabled={!showArcanaOption}
                  />
                  <label
                    htmlFor="exportArcana"
                    className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                  >
                    <Trans i18nKey="export_conversation.export_arcana" />
                  </label>
                </div>
              )}

              {showMcpServersOption && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="exportMcpServers"
                    checked={shareMcpServers}
                    onChange={() => {
                      setShareMcpServers(!shareMcpServers);
                    }}
                    className={`h-5 w-5 rounded-md border-gray-300 text-tertiary focus:ring-tertiary cursor-pointer transition duration-200 ease-in-out ${
                      !showMcpServersOption ? "bg-gray-400 cursor-not-allowed" : ""
                    }`}
                    disabled={!showMcpServersOption}
                  />
                  <label
                    htmlFor="exportMcpServers"
                    className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                  >
                    <Trans i18nKey="export_conversation.export_mcp_servers" />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Share settings button */}
        <button
          className="text-white p-3 bg-green-600 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
          onClick={() => handleShareSettings(shareArcana, shareMcpServers)}
        >
          <Trans i18nKey="common.share" />
        </button>
      </div>
      
    </BaseModal>
  );
}
