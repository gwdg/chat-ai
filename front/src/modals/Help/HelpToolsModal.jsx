import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function HelpToolsModal({ isOpen, onClose }) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="description.help_title">
      <p className="text-red-600">
        <Trans i18nKey="description.custom2" />
      </p>
      <p className="dark:text-white text-black text-sm">
        <Trans i18nKey="description.temperature" />
      </p>
    </BaseModal>
  );
}