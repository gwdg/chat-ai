import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function ErrorBadRequestModal({ isOpen, onClose }) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="common.notice"
    >
      <div className="flex flex-col gap-2">
        {/* Message */}
        <div className="pt-0 pb-2">
          <p className="text-base-content text-justify text-sm">
            <Trans i18nKey="alert.bad_request" />
          </p>
        </div>

        {/* Action Button */}
        <div className="flex md:justify-end justify-center w-full">
          <button
            className="btn btn-accent md:w-fit w-full min-w-[150px] select-none"
            onClick={onClose}
          >
            <Trans i18nKey="common.ok" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}