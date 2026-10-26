import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function WebSearchDisclaimer({ isOpen, onClose, onAgree }) {

  const handleAgree = (event) => {
    onAgree();
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} minimal={true}>
      <div className="flex flex-col gap-2">
        <p className="text-error">
          <Trans i18nKey="common.disclaimer" />
        </p>
        <p className="text-base-content text-sm whitespace-pre-line">
          <Trans i18nKey="alert.web_search_disclaimer" />
        </p>
        {/* Action Button */}
        <div className="flex flex-col md:flex-row gap-2 pt-4 justify-center w-full">
          <button
            className="btn btn-accent md:w-fit w-full min-w-[150px] select-none"
            onClick={handleAgree}
          >
            <Trans i18nKey="common.understand" />
          </button>
          <button
            className="btn btn-ghost text-primary dark:text-accent md:w-fit w-full min-w-[150px] select-none"
            onClick={onClose}
          >
            <Trans i18nKey="common.cancel" />
          </button>
        </div>
        </div>
    </BaseModal>
  );
}