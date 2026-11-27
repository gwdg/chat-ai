import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Branch, History } from "@carbon/icons-react";

import BaseModal from "../BaseModal";
import { GitErrorLine, GitFolderLine } from "./GitDialogBits";
import { readGitLog, readGitStatus } from "../../workspace/git/repo";

const formatDate = (ms, locale) => {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
};

/** The commits of the repository in the selected folder, newest first. */
export default function GitHistoryModal({
  isOpen,
  onClose,
  provider,
  path = "/",
  displayPath = "/",
}) {
  const { t, i18n } = useTranslation();
  const [commits, setCommits] = useState(null);
  const [branch, setBranch] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setCommits(await readGitLog(provider, path, 50));
      setBranch((await readGitStatus(provider, path)).branch);
      setError(null);
    } catch (reason) {
      setError(reason);
      setCommits([]);
    } finally {
      setLoading(false);
    }
  }, [path, provider]);

  useEffect(() => {
    if (!isOpen) return;
    void reload();
  }, [isOpen, reload]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="workspace.git.history"
      maxWidth="max-w-2xl"
    >
      <div className="flex flex-col gap-2 pb-2 text-sm">
        <GitFolderLine path={displayPath} />

        <div className="flex items-center gap-1.5 px-1 text-[11px] text-base-content/60">
          <Branch size={12} className="shrink-0 text-accent" />
          <span className="truncate font-mono text-base-content">
            {branch ?? t("workspace.git.detached")}
          </span>
          {commits ? (
            <span className="ml-auto shrink-0">
              {t("workspace.git.commit_total", { count: commits.length })}
            </span>
          ) : null}
        </div>

        <GitErrorLine error={error} />

        {loading ? (
          <p className="px-1 py-3 text-xs text-base-content/50">
            {t("common.loading")}
          </p>
        ) : commits && commits.length === 0 ? (
          <p className="rounded-lg border border-base-300 px-3 py-3 text-center text-xs text-base-content/60">
            {t("workspace.git.history_empty")}
          </p>
        ) : (
          <div className="flex max-h-[52vh] flex-col gap-1 overflow-y-auto pr-0.5">
            {(commits ?? []).map((commit) => (
              <div
                key={commit.oid}
                className="flex items-start gap-2 rounded-lg border border-base-300 px-2 py-1.5"
              >
                <History
                  size={13}
                  className="mt-0.5 shrink-0 text-base-content/40"
                />
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-xs font-medium text-base-content">
                    {commit.message || t("workspace.git.no_message")}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-base-content/50">
                    <span className="truncate">
                      {commit.author || t("workspace.git.unknown_author")}
                    </span>
                    <span>{formatDate(commit.date, i18n.language)}</span>
                    <span className="font-mono">{commit.oid.slice(0, 7)}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-1 flex justify-end">
          <button type="button" className="btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
