import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CloudDownload, WarningAlt } from "@carbon/icons-react";

import BaseModal from "../BaseModal";
import { GitErrorLine, GitFolderLine } from "./GitDialogBits";
import {
  cloneGitRepository,
  gitCorsProxy,
  usesPublicCorsProxy,
} from "../../workspace/git/repo";

/**
 * Clone a public (or token-protected) repository into the folder the file
 * manager has selected. The folder has to be empty: cloning into a folder that
 * already holds files would either overwrite them or leave a half-merged tree.
 */
export default function GitCloneModal({
  isOpen,
  onClose,
  provider,
  path = "/",
  displayPath = "/",
  onDone,
  notifySuccess,
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [shallow, setShallow] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);

  const proxy = gitCorsProxy();
  const publicProxy = usesPublicCorsProxy(proxy);
  const hasCredentials = password.trim().length > 0;
  const canClone = url.trim().length > 0 && !busy && !(publicProxy && hasCredentials);

  const reset = () => {
    setUrl("");
    setBranch("");
    setShallow(true);
    setUsername("");
    setPassword("");
    setError(null);
    setProgress(null);
    setBusy(false);
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const clone = async () => {
    if (!canClone) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      await cloneGitRepository(provider, path, {
        url: url.trim(),
        ref: branch.trim() || undefined,
        shallow,
        credentials: hasCredentials
          ? { username: username.trim(), password }
          : undefined,
        onProgress: (event) =>
          setProgress({ phase: event.phase, loaded: event.loaded, total: event.total }),
      });
      notifySuccess?.(t("workspace.git.clone_done"));
      onDone?.();
      reset();
      onClose();
    } catch (reason) {
      setError(reason);
      setBusy(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={close}
      titleKey="workspace.git.clone"
      maxWidth="max-w-lg"
    >
      <div className="flex flex-col gap-2 pb-2 text-sm">
        <GitFolderLine path={displayPath} />

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-base-content/55">
            {t("workspace.git.repository_url")}
          </span>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.org/team/project.git"
            className="input input-bordered w-full text-xs"
            autoFocus
          />
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-base-content/55">
              {t("workspace.git.branch_optional")}
            </span>
            <input
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              placeholder="main"
              className="input input-bordered input-sm w-full text-xs"
            />
          </label>
          <label className="flex items-end gap-2 pb-1 text-xs">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={shallow}
              onChange={(event) => setShallow(event.target.checked)}
            />
            {t("workspace.git.shallow")}
          </label>
        </div>

        <div className="rounded-lg border border-base-300 p-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/55">
            {t("workspace.git.credentials_optional")}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t("workspace.git.username")}
              autoComplete="username"
              className="input input-bordered input-sm w-full text-xs"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("workspace.git.token")}
              autoComplete="current-password"
              className="input input-bordered input-sm w-full text-xs"
            />
          </div>
          <p className="mt-1.5 flex items-start gap-1 text-[10px] text-base-content/50">
            <WarningAlt size={11} className="mt-px shrink-0 text-warning" />
            <span>
              {publicProxy
                ? t("workspace.git.public_proxy_no_credentials")
                : t("workspace.git.credentials_memory_only")}
            </span>
          </p>
        </div>

        <GitErrorLine error={error} />

        {progress ? (
          <div className="flex items-center gap-2 text-[10px] text-base-content/60">
            <span className="loading loading-spinner loading-xs" />
            <span className="truncate">{progress.phase}</span>
            {typeof progress.total === "number" && progress.total > 0 ? (
              <span className="ml-auto shrink-0 font-mono">
                {Math.round(((progress.loaded ?? 0) / progress.total) * 100)}%
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn" onClick={close} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            disabled={!canClone}
            onClick={() => void clone()}
          >
            {busy ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <CloudDownload size={15} />
            )}
            {t("workspace.git.clone_action")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
