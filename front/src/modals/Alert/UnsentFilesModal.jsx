import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function UnsentFilesModal({ isOpen, onClose, intentionalRefresh }) {
  const handleRefresh = () => {
    // Mark the refresh as intentional for any logic that needs it
    if (intentionalRefresh?.current !== undefined) {
      intentionalRefresh.current = true;
    }
    window.location.reload();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="common.notice"
      maxWidth="max-w-md"
    >
      {/* Message */}
      <div className="pt-0 pb-2">
        <p className="dark:text-white text-black text-justify text-sm">
          <Trans i18nKey="alert.unsent_files" />
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
        <button
          className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
          onClick={handleRefresh}
        >
          Refresh
        </button>
      </div>
    </BaseModal>
  );
}