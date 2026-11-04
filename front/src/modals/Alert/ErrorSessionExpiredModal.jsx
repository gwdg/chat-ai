import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function ErrorSessionExpiredModal({ isOpen }) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={() => {}} // Disabled because isForceAction=true
      titleKey="common.notice"
      isForceAction={true}
    >
      <div className="flex flex-col gap-2">
        {/* Message */}
        <div className="pt-0 pb-2">
          <p className="text-base-content text-justify text-sm">
            <Trans i18nKey="alert.session_expired" />
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
          <button
            className="btn btn-accent md:w-fit w-full min-w-[150px] select-none"
            onClick={() => location.reload()}
          >
            <Trans i18nKey="common.refresh" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}