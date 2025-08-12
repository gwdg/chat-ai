import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function ErrorSessionExpiredModal({ isOpen }) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={() => {}}      // Disabled because isForceAction=true
      titleKey="description.help_title"
      isForceAction={true}
    >
      <div className="flex flex-col gap-2">
        {/* Message */}
        <div className="pt-0 pb-2">
          <p className="dark:text-white text-black text-justify text-sm">
            <Trans i18nKey="description.session1" />
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
          <button
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none"
            onClick={() => location.reload()}
          >
            <Trans i18nKey="description.session3" />
          </button>
        </div>
      </div>
    </BaseModal>
  );
}