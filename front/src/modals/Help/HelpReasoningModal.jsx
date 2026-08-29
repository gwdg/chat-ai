import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function HelpReasoningModal({ isOpen, onClose }) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="help.title">
      <p className="dark:text-white text-black text-sm">
        <Trans i18nKey="help.reasoning" />
      </p>
    </BaseModal>
  );
}
