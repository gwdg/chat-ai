import { useRef } from "react";
import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

/**
 * Asks to grant the agent access to a previously mounted local folder again. The browser
 * drops folder permissions on reload, and only re-grants them in response to a click.
 *
 * Props:
 * - name (string): the folder's name
 * - onAllow (function): requests the permission; must run inside the click
 * - onDeny (function): runs when the dialog is dismissed without allowing
 */
export default function FolderAccessModal({ isOpen, onClose, name, onAllow, onDeny }) {
  // Closing after "Allow" must not count as a refusal
  const answered = useRef(false);

  const handleAllow = async () => {
    answered.current = true;
    await onAllow();
    onClose();
  };

  const handleClose = () => {
    if (!answered.current) onDeny();
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} titleKey="alert.title">
      <div className="pt-0 pb-2">
        <p className="dark:text-white text-black text-justify text-sm">
          <Trans i18nKey="alert.folder_access" values={{ name }} />
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm mt-4">
        <button
          className="text-black dark:text-white p-3 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[130px] select-none cursor-pointer"
          onClick={handleClose}
        >
          <Trans i18nKey="common.cancel" />
        </button>
        <button
          className="text-white p-3 dark:border-border_dark rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[130px] select-none cursor-pointer bg-tertiary"
          onClick={handleAllow}
        >
          <Trans i18nKey="common.allow" />
        </button>
      </div>
    </BaseModal>
  );
}
