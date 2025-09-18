import { Link } from "react-router-dom";
import { Trans } from "react-i18next";
import BaseModal from "../BaseModal";

export default function HelpModelsModal({ isOpen, onClose }) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="help.title">
      <p className="text-red-600">
        <Trans i18nKey="alert.settings_external" />
      </p>
      <p className="dark:text-white text-black text-sm">
        <Trans i18nKey="help.models"></Trans>{" "}
            {/* Move the link inside the paragraph */}
            <Link
              to={"https://docs.hpc.gwdg.de/services/chat-ai/index.html"}
              target="_blank"
              className="text-tertiary underline text-sm"
            >
              Link
            </Link>
      </p>
    </BaseModal>
  );
}