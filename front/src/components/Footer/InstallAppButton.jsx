import { Download } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import useInstallPrompt from "../../hooks/useInstallPrompt";

/**
 * Footer button that offers the browser's install dialog. It renders nothing
 * unless the browser reported the app as installable (`beforeinstallprompt`),
 * so a user who already installed it, or a browser without the API, never sees
 * a dead control.
 */
export default function InstallAppButton() {
  const { t } = useTranslation();
  const { canInstall, promptInstall } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm btn-square touch-manipulation"
      data-guide="pwa-install"
      title={t("pwa.install")}
      aria-label={t("pwa.install")}
      onClick={() => {
        void promptInstall();
      }}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <Download size={20} className="flex-shrink-0 text-accent" />
    </button>
  );
}
