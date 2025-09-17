import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function HelpMCPModal({ isOpen, onClose }) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="common.notice">
      <p className="text-red-600">
        <Trans i18nKey="alert.settings_external" />
      </p>
      <p className="dark:text-white text-black text-sm">
        <Trans i18nKey="help.mcp" />
      </p>
    </BaseModal>
  );
}