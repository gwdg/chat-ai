import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function HelpMemoryModal({ isOpen, onClose }) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="help.title">
      <p className="text-red-600">
        <Trans i18nKey="alert.settings_external" />
      </p>
      <p className="dark:text-white text-black text-sm">
        <Trans i18nKey="help.memory" />
      </p>
    </BaseModal>
  );
}