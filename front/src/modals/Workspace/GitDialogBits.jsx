import { useTranslation } from "react-i18next";
import { Folder } from "@carbon/icons-react";

import { gitErrorText } from "../../workspace/git/errors";

/** The folder every Git action in a dialog applies to. */
export function GitFolderLine({ path }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-base-300 bg-base-200/50 px-2 py-1.5 text-[11px] text-base-content/70">
      <Folder size={13} className="shrink-0 text-accent" />
      <span className="truncate font-mono" title={path}>
        {path || "/"}
      </span>
      <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-base-content/40">
        {t("workspace.git.folder_label")}
      </span>
    </div>
  );
}

export function GitErrorLine({ error }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <p className="break-words text-xs text-error">{gitErrorText(error, t)}</p>
  );
}
