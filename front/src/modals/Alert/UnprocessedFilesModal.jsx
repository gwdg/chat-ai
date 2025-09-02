import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function UnprocessedFilesModal({ isOpen, onClose }) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="alert.title"
    >
      {/* Description text */}
      <div className="pt-0 pb-2">
        <p className="dark:text-white text-black text-justify text-sm">
          <Trans i18nKey="alert.unprocessed_files" />
        </p>
      </div>

      {/* OK Button */}
      <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
        <button
          className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
          onClick={onClose}
        >
          <Trans i18nKey="ok" defaultValue="OK" />
        </button>
      </div>
    </BaseModal>
  );
}