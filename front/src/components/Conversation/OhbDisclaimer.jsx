import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";

// Extensive OHB usage disclaimer, shown below the input box on every new
// (empty) conversation.
export default function OhbDisclaimer() {
  const { t } = useTranslation();

  const sections = [
    { title: t("alert.ohb_disclaimer.s1_title"), body: t("alert.ohb_disclaimer.s1") },
    { title: t("alert.ohb_disclaimer.s2_title"), body: t("alert.ohb_disclaimer.s2") },
    { title: t("alert.ohb_disclaimer.s3_title"), body: t("alert.ohb_disclaimer.s3") },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto mt-3 px-4 py-3 text-left select-none rounded-lg bg-gray-100 dark:bg-bg_dark text-gray-700 dark:text-gray-300 text-xs leading-relaxed shadow-sm dark:shadow-dark">
      <p className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
        <Trans i18nKey="alert.ohb_disclaimer.title" />
      </p>
      {sections.map((section) => (
        <p key={section.title} className="mb-1.5">
          <span className="font-semibold">{section.title}</span> {section.body}
        </p>
      ))}
      <p className="mb-0">
        <span className="font-semibold">
          <Trans i18nKey="alert.ohb_disclaimer.s4_title" />
        </span>{" "}
        <Trans i18nKey="alert.ohb_disclaimer.s4_pre" />
        <Link
          to="https://docs.hpc.gwdg.de/services/chat-ai/data-privacy.de/index.html"
          target="_blank"
          className="text-tertiary hover:underline"
        >
          <Trans i18nKey="alert.ohb_disclaimer.s4_link" />
        </Link>
        <Trans i18nKey="alert.ohb_disclaimer.s4_post" />
      </p>
    </div>
  );
}
