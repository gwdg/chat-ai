import { Trans, useTranslation } from "react-i18next";
import BaseModal from "../BaseModal";

export default function HelpArcanaModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} titleKey="common.notice">
      <p className="text-base-content text-sm">
        <Trans i18nKey="help.arcana" />
      </p>
      <p className="text-base-content text-sm mt-2">
        {t("alert.arcana_create_collection_prefix") + " "}
        <a
          href="https://chat-ai.academiccloud.de/arcanas/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold"
        >
          {t("alert.arcana_create_collection_link")}
        </a>
        .
      </p>
    </BaseModal>
  );
}
