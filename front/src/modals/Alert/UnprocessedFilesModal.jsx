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
        <p className="text-base-content text-justify text-sm">
          <Trans i18nKey="alert.unprocessed_files" />
        </p>
      </div>

      {/* OK Button */}
      <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
        <button
          className="btn btn-accent md:w-fit w-full min-w-[150px] select-none"
          onClick={onClose}
        >
          <Trans i18nKey="ok" defaultValue="OK" />
        </button>
      </div>
    </BaseModal>
  );
}