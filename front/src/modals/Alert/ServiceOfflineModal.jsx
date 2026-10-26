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
      titleKey="common.notice"
    >
      {/* Message */}
      <div className="flex flex-col gap-2">
        <div className="pt-0 pb-2">
          <p className="text-base-content text-justify text-sm">
            <Trans i18nKey="alert.model_offline" />
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-col md:flex-row gap-2 justify-center w-full">
          <button
            className="btn btn-accent md:w-fit w-full min-w-[150px] select-none"
            onClick={handleOkClick}
          >
            Ok
          </button>
        </div>
      </div>
    </BaseModal>
  );
}