import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function HelpMemoryModal({ isOpen, onClose }) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="help.title">
      <p className="text-base-content text-sm">
        <Trans i18nKey="help.memory" />
      </p>
    </BaseModal>
  );
}
