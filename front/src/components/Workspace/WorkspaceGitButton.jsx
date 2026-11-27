import { useTranslation } from "react-i18next";
import { Branch } from "@carbon/icons-react";

import { useModal } from "../../modals/ModalContext";

/** Sources whose files a Git repository can live in. Arcana, MCP and agent
 * sources are flat or read-only views, so a checkout would have nowhere to go. */
export const GIT_SOURCE_KINDS = new Set(["browser", "local", "saia-fs"]);

export const supportsGit = (provider, readOnly = false) =>
  Boolean(
    provider &&
      !readOnly &&
      GIT_SOURCE_KINDS.has(provider.kind) &&
      provider.capabilities?.read &&
      provider.capabilities?.write &&
      provider.capabilities?.delete &&
      provider.capabilities?.mkdir,
  );

/**
 * The Git entry point of the file manager toolbar. It acts on the folder that is
 * selected in the tree, and opens a dialog instead of a dropdown because the
 * tree clips its overflow.
 */
export default function WorkspaceGitButton({
  provider,
  path = "/",
  displayPath = "/",
  readOnly = false,
  onChanged,
}) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const supported = supportsGit(provider, readOnly);

  return (
    <button
      type="button"
      data-guide="workspace-git"
      disabled={!supported}
      onClick={() =>
        openModal("gitMenu", {
          provider,
          path,
          displayPath,
          readOnly,
          onDone: onChanged,
        })
      }
      title={
        supported
          ? t("workspace.git.button_hint", { path: displayPath || "/" })
          : t("workspace.git.button_unsupported")
      }
      aria-label={t("workspace.git.button")}
      className="btn btn-ghost btn-xs shrink-0 gap-1"
    >
      <Branch size={14} />
      <span className="truncate">{t("workspace.git.button")}</span>
    </button>
  );
}
