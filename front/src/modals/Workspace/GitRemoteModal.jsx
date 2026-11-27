import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CloudDownload,
  CloudUpload,
  Link,
  Renew,
  WarningAlt,
} from "@carbon/icons-react";

import BaseModal from "../BaseModal";
import { GitErrorLine, GitFolderLine } from "./GitDialogBits";
import {
  fetchGitRemote,
  forgetGitCredentials,
  gitCorsProxy,
  hasGitCredentials,
  listGitRemotes,
  loadGitIdentity,
  pullGitRemote,
  pushGitRemote,
  rememberGitCredentials,
  setGitRemote,
  usesPublicCorsProxy,
} from "../../workspace/git/repo";

/**
 * The remote of the repository in the selected folder: its URL, the credentials
 * used for this session, and fetch/pull/push. Credentials stay in module memory
 * so a reload forgets them.
 */
export default function GitRemoteModal({
  isOpen,
  onClose,
  provider,
  path = "/",
  displayPath = "/",
  onDone,
  notifySuccess,
}) {
  const { t } = useTranslation();
  const [origin, setOrigin] = useState(null);
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remembered, setRemembered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);

  const publicProxy = usesPublicCorsProxy(gitCorsProxy());
  const credentials = password.trim()
    ? { username: username.trim(), password }
    : undefined;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const remotes = await listGitRemotes(provider, path);
      const found = remotes.find((item) => item.name === "origin") ?? null;
      setOrigin(found);
      setUrl(found?.url ?? "");
      setRemembered(hasGitCredentials(provider, path));
      setError(null);
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [path, provider]);

  useEffect(() => {
    if (!isOpen) return;
    setUsername("");
    setPassword("");
    setBusy("");
    setProgress(null);
    void reload();
  }, [isOpen, reload]);

  const save = async () => {
    if (!url.trim() || busy) return;
    setBusy("save");
    setError(null);
    try {
      await setGitRemote(provider, path, { name: "origin", url: url.trim() });
      notifySuccess?.(t("workspace.git.remote_saved"));
      await reload();
      onDone?.();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy("");
    }
  };

  const keepCredentials = () => {
    if (credentials) {
      rememberGitCredentials(provider, path, credentials);
      setRemembered(true);
    }
  };

  const run = async (label, action) => {
    setBusy(label);
    setError(null);
    setProgress(null);
    try {
      await action();
      notifySuccess?.(t(`workspace.git.${label}_done`));
      onDone?.();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy("");
      setProgress(null);
    }
  };

  const onProgress = (event) =>
    setProgress({
      phase: event.phase,
      loaded: event.loaded,
      total: event.total,
    });

  const fetch = () =>
    run("fetch", () => {
      if (credentials) keepCredentials();
      return fetchGitRemote(provider, path, { credentials, onProgress });
    });

  const pull = () =>
    run("pull", () => {
      if (credentials) keepCredentials();
      return pullGitRemote(provider, path, {
        credentials,
        identity: loadGitIdentity(),
        onProgress,
      });
    });

  const push = () =>
    run("push", () => {
      if (credentials) keepCredentials();
      return pushGitRemote(provider, path, { credentials, onProgress });
    });

  const forget = () => {
    forgetGitCredentials(provider, path);
    setRemembered(false);
    setUsername("");
    setPassword("");
  };

  const hasRemote = Boolean(origin?.url);
  const canNetwork = hasRemote && !busy && !(publicProxy && password.trim());

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="workspace.git.remote"
      maxWidth="max-w-lg"
    >
      <div className="flex flex-col gap-2 pb-2 text-sm">
        <GitFolderLine path={displayPath} />

        {loading ? (
          <p className="px-1 py-2 text-xs text-base-content/50">
            {t("common.loading")}
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/55">
                <Link size={11} />
                {t("workspace.git.remote_url")}
              </span>
              <div className="flex items-center gap-2">
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.org/team/project.git"
                  className="input input-bordered min-w-0 flex-1 text-xs"
                />
                <button
                  type="button"
                  className="btn btn-accent btn-sm shrink-0"
                  disabled={!url.trim() || url.trim() === origin?.url || Boolean(busy)}
                  onClick={() => void save()}
                >
                  {t("common.save")}
                </button>
              </div>
            </label>

            <div className="rounded-lg border border-base-300 p-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/55">
                {t("workspace.git.credentials_this_session")}
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
              {remembered ? (
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-base-content/55">
                  <span>{t("workspace.git.credentials_remembered")}</span>
                  <button
                    type="button"
                    className="link link-hover text-error"
                    onClick={forget}
                  >
                    {t("workspace.git.forget_credentials")}
                  </button>
                </div>
              ) : null}
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

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className="btn btn-sm gap-1"
                disabled={!canNetwork}
                onClick={() => void fetch()}
              >
                {busy === "fetch" ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Renew size={14} />
                )}
                {t("workspace.git.fetch")}
              </button>
              <button
                type="button"
                className="btn btn-sm gap-1"
                disabled={!canNetwork}
                onClick={() => void pull()}
              >
                {busy === "pull" ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <CloudDownload size={14} />
                )}
                {t("workspace.git.pull")}
              </button>
              <button
                type="button"
                className="btn btn-sm gap-1"
                disabled={!canNetwork}
                onClick={() => void push()}
              >
                {busy === "push" ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <CloudUpload size={14} />
                )}
                {t("workspace.git.push")}
              </button>
              {!hasRemote ? (
                <span className="text-[10px] text-base-content/50">
                  {t("workspace.git.no_remote")}
                </span>
              ) : null}
            </div>
          </>
        )}

        <div className="mt-1 flex justify-end">
          <button type="button" className="btn" onClick={onClose} disabled={Boolean(busy)}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
