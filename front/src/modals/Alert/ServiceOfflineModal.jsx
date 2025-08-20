import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";
import { checkService } from "../../apis/checkService";

export default function ServiceOfflineModal({ isOpen, onClose, model }) {
  async function handleOkClick() {
    // Close modal first
    onClose();
    // Then make the request
    try {
      await checkService(model);
    } catch (error) {
      console.error("An error occurred", error);
    }
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="description.help_title"
    >
      {/* Message */}
      <div className="flex flex-col gap-2">
        <div className="pt-0 pb-2">
          <p className="dark:text-white text-black text-justify text-sm">
            <Trans i18nKey="description.offline" />
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
          <button
            className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none cursor-pointer"
            onClick={handleOkClick}
          >
            Ok
          </button>
        </div>
      </div>
    </BaseModal>
  );
}