import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Branch, Close, TrashCan, WarningAlt } from "@carbon/icons-react";

import BaseModal from "../BaseModal";
import { GitErrorLine, GitFolderLine } from "./GitDialogBits";
import {
  commitGitChanges,
  discardGitChanges,
  loadGitIdentity,
  readGitStatus,
  stageGitFiles,
  unstageGitFiles,
} from "../../workspace/git/repo";

const shortCode = (file) =>
  `${file.index}${file.worktree}`.replace(/\s+/g, "") || "?";

function ChangeRow({ file, children }) {
  const deleted = file.deleted;
  const untracked = file.untracked;
  return (
    <div className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-base-200/60">
      <span
        className={`w-5 shrink-0 text-center font-mono text-[10px] font-semibold ${
          untracked
            ? "text-base-content/40"
            : deleted
              ? "text-error"
              : "text-accent"
        }`}
        title={shortCode(file)}
      >
        {shortCode(file)}
      </span>
      <span
        className="min-w-0 flex-1 truncate font-mono text-[11px] text-base-content/80"
        title={file.path}
      >
        {file.path}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">{children}</span>
    </div>
  );
}

/**
 * Stage, unstage, discard and commit — the working-tree view of the repository
 * in the folder that is selected in the file manager.
 */
export default function GitChangesModal({
  isOpen,
  onClose,
  provider,
  path = "/",
  displayPath = "/",
  onDone,
  notifySuccess,
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [identity, setIdentity] = useState(() => loadGitIdentity());
  const [discardTarget, setDiscardTarget] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await readGitStatus(provider, path));
      setError(null);
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [path, provider]);

  useEffect(() => {
    if (!isOpen) return;
    setMessage("");
    setDiscardTarget(null);
    void reload();
  }, [isOpen, reload]);

  const run = async (label, action) => {
    setBusy(label);
    setError(null);
    try {
      await action();
      await reload();
      onDone?.();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy("");
    }
  };

  const staged = status?.files.filter((file) => file.staged) ?? [];
  const unstaged = status?.files.filter((file) => file.unstaged) ?? [];
  const canCommit =
    staged.length > 0 &&
    message.trim().length > 0 &&
    identity.name.trim().length > 0 &&
    identity.email.trim().length > 0 &&
    !busy;

  const commit = async () => {
    if (!canCommit) return;
    setBusy("commit");
    setError(null);
    try {
      await commitGitChanges(provider, path, {
        message,
        identity: {
          name: identity.name.trim(),
          email: identity.email.trim(),
        },
      });
      notifySuccess?.(t("workspace.git.commit_done"));
      onDone?.();
      onClose();
    } catch (reason) {
      setError(reason);
      setBusy("");
    }
  };

  const discard = async (file) => {
    setDiscardTarget(null);
    await run("discard", () => discardGitChanges(provider, path, [file]));
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="workspace.git.changes"
      maxWidth="max-w-2xl"
    >
      <div className="flex flex-col gap-2 pb-2 text-sm">
        <GitFolderLine path={displayPath} />

        <div className="flex items-center gap-1.5 px-1 text-[11px] text-base-content/60">
          <Branch size={12} className="shrink-0 text-accent" />
          <span className="truncate font-mono text-base-content">
            {status?.branch ?? t("workspace.git.detached")}
          </span>
          {busy ? (
            <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px]">
              <span className="loading loading-spinner loading-xs" />
              {t("workspace.git.working")}
            </span>
          ) : null}
        </div>

        <GitErrorLine error={error} />

        {loading && !status ? (
          <p className="px-1 py-3 text-xs text-base-content/50">
            {t("workspace.git.reading_status")}
          </p>
        ) : status && status.files.length === 0 ? (
          <p className="rounded-lg border border-base-300 px-3 py-3 text-center text-xs text-base-content/60">
            {t("workspace.git.clean")}
          </p>
        ) : (
          <div className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto pr-0.5">
            <section className="rounded-lg border border-base-300">
              <header className="flex items-center gap-1.5 border-b border-base-300 px-2 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-base-content/60">
                  {t("workspace.git.staged_section", { count: staged.length })}
                </span>
                {staged.length > 0 && (
                  <button
                    type="button"
                    className="ml-auto text-[10px] text-accent hover:underline"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void run("unstage", () =>
                        unstageGitFiles(
                          provider,
                          path,
                          staged.map((file) => file.path),
                        ),
                      )
                    }
                  >
                    {t("workspace.git.unstage_all")}
                  </button>
                )}
              </header>
              <div className="px-1 py-1">
                {staged.length === 0 ? (
                  <p className="px-1 py-1 text-[10px] text-base-content/45">
                    {t("workspace.git.nothing_staged")}
                  </p>
                ) : (
                  staged.map((file) => (
                    <ChangeRow key={`staged:${file.path}`} file={file}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void run("unstage", () =>
                            unstageGitFiles(provider, path, [file.path]),
                          )
                        }
                      >
                        {t("workspace.git.unstage")}
                      </button>
                    </ChangeRow>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-base-300">
              <header className="flex items-center gap-1.5 border-b border-base-300 px-2 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-base-content/60">
                  {t("workspace.git.unstaged_section", {
                    count: unstaged.length,
                  })}
                </span>
                {unstaged.length > 0 && (
                  <button
                    type="button"
                    className="ml-auto text-[10px] text-accent hover:underline"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void run("stage", () => stageGitFiles(provider, path))
                    }
                  >
                    {t("workspace.git.stage_all")}
                  </button>
                )}
              </header>
              <div className="px-1 py-1">
                {unstaged.length === 0 ? (
                  <p className="px-1 py-1 text-[10px] text-base-content/45">
                    {t("workspace.git.nothing_unstaged")}
                  </p>
                ) : (
                  unstaged.map((file) => (
                    <ChangeRow key={`unstaged:${file.path}`} file={file}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void run("stage", () =>
                            stageGitFiles(provider, path, [file.path]),
                          )
                        }
                      >
                        {t("workspace.git.stage")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square text-error"
                        title={t("workspace.git.discard")}
                        aria-label={t("workspace.git.discard")}
                        disabled={Boolean(busy)}
                        onClick={() => setDiscardTarget(file)}
                      >
                        <TrashCan size={13} />
                      </button>
                    </ChangeRow>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {discardTarget && (
          <div className="flex items-start gap-2 rounded-lg border border-error/40 bg-error/10 px-2 py-1.5 text-[11px]">
            <WarningAlt size={14} className="mt-px shrink-0 text-error" />
            <span className="min-w-0 flex-1 break-words">
              {t(
                discardTarget.untracked
                  ? "workspace.git.discard_untracked_confirm"
                  : "workspace.git.discard_confirm",
                { name: discardTarget.path },
              )}
            </span>
            <button
              type="button"
              className="btn btn-error btn-xs"
              onClick={() => void discard(discardTarget)}
            >
              {t("workspace.git.discard")}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              onClick={() => setDiscardTarget(null)}
              aria-label={t("common.cancel")}
            >
              <Close size={13} />
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-base-300 p-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-base-content/55">
              {t("workspace.git.commit_message")}
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={2}
              placeholder={t("workspace.git.commit_message_placeholder")}
              className="textarea textarea-bordered w-full text-xs"
            />
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-base-content/55">
                {t("workspace.git.author_name")}
              </span>
              <input
                value={identity.name}
                onChange={(event) =>
                  setIdentity((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="input input-bordered input-sm w-full text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-base-content/55">
                {t("workspace.git.author_email")}
              </span>
              <input
                value={identity.email}
                onChange={(event) =>
                  setIdentity((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className="input input-bordered input-sm w-full text-xs"
              />
            </label>
          </div>
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-accent"
            disabled={!canCommit}
            onClick={() => void commit()}
          >
            {busy === "commit" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            {t("workspace.git.commit", { count: staged.length })}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
