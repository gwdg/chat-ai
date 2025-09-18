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
        <p className="text-red-600">
          <Trans i18nKey="common.disclaimer" />
        </p>
        <p className="dark:text-white text-black text-sm whitespace-pre-line">
          <Trans i18nKey="alert.web_search_disclaimer" />
        </p>
        {/* Action Button */}
        <div className="flex flex-col md:flex-row gap-2 pt-4 justify-center w-full">
          <button
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
            onClick={handleAgree}
          >
            <Trans i18nKey="common.understand" />
          </button>
          <button
            className="text-primary dark:text-tertiary p-3 justify-center items-center md:w-fit w-full min-w-[150px] select-none cursor-pointer"
            onClick={onClose}
          >
            <Trans i18nKey="common.cancel" />
          </button>
        </div>
        </div>
    </BaseModal>
  );
}