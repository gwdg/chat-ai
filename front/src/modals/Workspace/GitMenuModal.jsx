import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Add,
  Branch,
  ChevronRight,
  CloudDownload,
  Commit,
  Folder,
  History,
  Renew,
} from "@carbon/icons-react";

import BaseModal from "../BaseModal";
import { useModal } from "../ModalContext";
import {
  GitErrorLine,
  GitFolderLine,
} from "./GitDialogBits";
import {
  initGitRepository,
  isGitRepository,
  readGitStatus,
} from "../../workspace/git/repo";

const GIT_KINDS = new Set(["browser", "local", "saia-fs"]);

function MenuRow({
  icon,
  label,
  hint,
  badge,
  onClick,
  disabled = false,
  busy = false,
  ...rest
}) {
  return (
    <button
      type="button"
      {...rest}
      onClick={onClick}
      disabled={disabled || busy}
      className="flex w-full items-center gap-2 rounded-lg border border-base-300 px-2.5 py-2 text-left transition-colors hover:bg-base-200/70 disabled:opacity-50"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-base-200 text-accent">
        {busy ? <span className="loading loading-spinner loading-xs" /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-base-content">
          {label}
        </span>
        {hint ? (
          <span className="block truncate text-[10px] text-base-content/50">
            {hint}
          </span>
        ) : null}
      </span>
      {badge ? (
        <span className="badge badge-sm shrink-0 border-base-300 bg-base-200 text-[10px] text-base-content/70">
          {badge}
        </span>
      ) : (
        <ChevronRight size={14} className="shrink-0 text-base-content/40" />
      )}
    </button>
  );
}

/**
 * The Git menu of the file manager. It acts on the folder that is selected in
 * the tree, never on a single file, so the commit dialog and every other
 * operation see the same repository root.
 */
export default function GitMenuModal({
  isOpen,
  onClose,
  provider,
  path = "/",
  displayPath = "/",
  readOnly = false,
  onDone,
  notifySuccess,
}) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);
  const [repository, setRepository] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!provider) {
      setSupported(false);
      setLoading(false);
      return;
    }
    const writable =
      provider.capabilities?.read &&
      provider.capabilities?.write &&
      provider.capabilities?.delete &&
      provider.capabilities?.mkdir;
    if (readOnly || !GIT_KINDS.has(provider.kind) || !writable) {
      setSupported(false);
      setLoading(false);
      return;
    }
    setSupported(true);
    setLoading(true);
    setError(null);
    try {
      const repo = await isGitRepository(provider, path);
      setRepository(repo);
      setStatus(repo ? await readGitStatus(provider, path) : null);
    } catch (reason) {
      setError(reason);
      setRepository(false);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [path, provider, readOnly]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  // Opening a child replaces this menu (one modal at a time), so the child must
  // not carry its own `onClose`: the modal context supplies the real close.
  const childProps = {
    provider,
    path,
    displayPath,
    onDone,
  };

  const initialize = async () => {
    setBusy("init");
    setError(null);
    try {
      await initGitRepository(provider, path);
      notifySuccess?.(t("workspace.git.init_done"));
      await load();
      onDone?.();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy("");
    }
  };

  const changes = status?.files.length ?? 0;
  const branch = status?.branch;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="workspace.git.menu_title"
      maxWidth="max-w-md"
    >
      <div
        data-guide="git-menu"
        className="flex flex-col gap-2 pb-2 text-sm"
      >
        <GitFolderLine path={displayPath} />

        {!supported ? (
          <p className="rounded-lg border border-base-300 px-3 py-2 text-xs text-base-content/60">
            {readOnly
              ? t("workspace.git.error.read_only_provider")
              : t("workspace.git.unsupported_source")}
          </p>
        ) : loading ? (
          <p className="px-1 py-2 text-xs text-base-content/50">
            {t("workspace.git.reading_status")}
          </p>
        ) : (
          <>
            <div
              data-guide="git-menu-status"
              className="flex items-center gap-1.5 px-1 text-[11px] text-base-content/60"
            >
              <Branch size={12} className="shrink-0 text-accent" />
              {repository ? (
                <>
                  <span className="truncate font-mono text-base-content">
                    {branch ?? t("workspace.git.detached")}
                  </span>
                  <span className="ml-auto shrink-0">
                    {status?.clean
                      ? t("workspace.git.clean")
                      : t("workspace.git.change_count", { count: changes })}
                  </span>
                </>
              ) : (
                <span>{t("workspace.git.not_a_repository")}</span>
              )}
            </div>

            <GitErrorLine error={error} />

            {repository ? (
              <>
                <MenuRow
                  icon={<Commit size={15} />}
                  label={t("workspace.git.changes")}
                  hint={t("workspace.git.changes_hint")}
                  data-guide="git-menu-changes"
                  badge={changes > 0 ? changes : undefined}
                  onClick={() =>
                    openModal("gitChanges", {
                      ...childProps,
                    })
                  }
                />
                <MenuRow
                  icon={<Branch size={15} />}
                  label={t("workspace.git.branches")}
                  hint={t("workspace.git.branches_hint")}
                  data-guide="git-menu-branches"
                  onClick={() =>
                    openModal("gitBranches", {
                      ...childProps,
                    })
                  }
                />
                <MenuRow
                  icon={<CloudDownload size={15} />}
                  label={t("workspace.git.remote")}
                  hint={t("workspace.git.remote_hint")}
                  data-guide="git-menu-remote"
                  onClick={() =>
                    openModal("gitRemote", {
                      ...childProps,
                    })
                  }
                />
                <MenuRow
                  icon={<History size={15} />}
                  label={t("workspace.git.history")}
                  hint={t("workspace.git.history_hint")}
                  data-guide="git-menu-history"
                  onClick={() =>
                    openModal("gitHistory", {
                      ...childProps,
                    })
                  }
                />
                <MenuRow
                  icon={<Renew size={15} />}
                  label={t("workspace.git.refresh")}
                  hint={t("workspace.git.refresh_hint")}
                  data-guide="git-menu-refresh"
                  onClick={() => void load()}
                />
              </>
            ) : (
              <>
                <MenuRow
                  icon={<Add size={15} />}
                  label={t("workspace.git.init")}
                  hint={t("workspace.git.init_hint")}
                  data-guide="git-menu-init"
                  busy={busy === "init"}
                  onClick={() => void initialize()}
                />
                <MenuRow
                  icon={<CloudDownload size={15} />}
                  label={t("workspace.git.clone")}
                  hint={t("workspace.git.clone_hint")}
                  data-guide="git-menu-clone"
                  onClick={() =>
                    openModal("gitClone", {
                      ...childProps,
                    })
                  }
                />
              </>
            )}

            <div className="mt-1 flex items-start gap-1.5 px-1 text-[10px] text-base-content/45">
              <Folder size={11} className="mt-px shrink-0" />
              <span>{t("workspace.git.folder_scope")}</span>
            </div>
          </>
        )}
      </div>
    </BaseModal>
  );
}
