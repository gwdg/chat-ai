import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Branch, Checkmark, TrashCan } from "@carbon/icons-react";

import BaseModal from "../BaseModal";
import { GitErrorLine, GitFolderLine } from "./GitDialogBits";
import {
  checkoutGitBranch,
  createGitBranch,
  deleteGitBranch,
  listGitBranches,
} from "../../workspace/git/repo";

/**
 * Local and remote branches of the repository in the selected folder. Checking
 * out a remote-only branch creates the local tracking branch; deleting is only
 * offered for a local branch that is not the current one.
 */
export default function GitBranchesModal({
  isOpen,
  onClose,
  provider,
  path = "/",
  displayPath = "/",
  onDone,
  notifySuccess,
}) {
  const { t } = useTranslation();
  const [info, setInfo] = useState(null);
  const [name, setName] = useState("");
  const [checkoutNew, setCheckoutNew] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setInfo(await listGitBranches(provider, path));
      setError(null);
    } catch (reason) {
      setError(reason);
    }
  }, [path, provider]);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setBusy("");
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

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    await run("create", async () => {
      await createGitBranch(provider, path, trimmed, { checkout: checkoutNew });
      notifySuccess?.(t("workspace.git.branch_created", { name: trimmed }));
      setName("");
    });
  };

  const checkout = async (ref) => {
    if (busy || ref === info?.current) return;
    await run(`checkout:${ref}`, async () => {
      await checkoutGitBranch(provider, path, ref);
      notifySuccess?.(t("workspace.git.branch_checked_out", { name: ref }));
    });
  };

  const remove = async (ref) => {
    if (busy) return;
    await run(`delete:${ref}`, async () => {
      await deleteGitBranch(provider, path, ref);
      notifySuccess?.(t("workspace.git.branch_deleted", { name: ref }));
    });
  };

  const local = info?.local ?? [];
  const remote = info?.remote ?? [];

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="workspace.git.branches"
      maxWidth="max-w-lg"
    >
      <div className="flex flex-col gap-2 pb-2 text-sm">
        <GitFolderLine path={displayPath} />

        <div className="flex items-center gap-1.5 px-1 text-[11px] text-base-content/60">
          <Branch size={12} className="shrink-0 text-accent" />
          <span>
            {t("workspace.git.current_branch")}{" "}
            <span className="font-mono text-base-content">
              {info?.current ?? t("workspace.git.detached")}
            </span>
          </span>
          {busy ? (
            <span className="ml-auto flex items-center gap-1 text-[10px]">
              <span className="loading loading-spinner loading-xs" />
              {t("workspace.git.working")}
            </span>
          ) : null}
        </div>

        <GitErrorLine error={error} />

        <div className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto pr-0.5">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/55">
            {t("workspace.git.local_branches")}
          </p>
          {local.length === 0 ? (
            <p className="px-1 py-1 text-[10px] text-base-content/45">
              {t("workspace.git.no_branches")}
            </p>
          ) : (
            local.map((ref) => {
              const current = ref === info?.current;
              return (
                <div
                  key={`local:${ref}`}
                  className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-base-200/60"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    disabled={busy}
                    onClick={() => void checkout(ref)}
                  >
                    <span className="w-4 shrink-0">
                      {current ? (
                        <Checkmark size={13} className="text-success" />
                      ) : null}
                    </span>
                    <span className="truncate font-mono text-[11px] text-base-content/85">
                      {ref}
                    </span>
                    {current ? (
                      <span className="ml-auto shrink-0 text-[10px] text-success">
                        {t("workspace.git.head")}
                      </span>
                    ) : null}
                  </button>
                  {!current ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-square text-error"
                      title={t("workspace.git.delete_branch")}
                      aria-label={t("workspace.git.delete_branch")}
                      disabled={Boolean(busy)}
                      onClick={() => void remove(ref)}
                    >
                      <TrashCan size={13} />
                    </button>
                  ) : null}
                </div>
              );
            })
          )}

          {remote.length > 0 ? (
            <>
              <p className="mt-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/55">
                {t("workspace.git.remote_branches")}
              </p>
              {remote.map((ref) => (
                <button
                  key={`remote:${ref}`}
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void checkout(ref)}
                  className="flex items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-base-200/60"
                >
                  <span className="w-4 shrink-0" />
                  <span className="truncate font-mono text-[11px] text-base-content/70">
                    {ref}
                  </span>
                </button>
              ))}
            </>
          ) : null}
        </div>

        <div className="rounded-lg border border-base-300 p-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-base-content/55">
            {t("workspace.git.new_branch")}
          </p>
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="feature-x"
              className="input input-bordered input-sm min-w-0 flex-1 text-xs"
              onKeyDown={(event) => {
                if (event.key === "Enter") void create();
              }}
            />
            <button
              type="button"
              className="btn btn-accent btn-sm"
              disabled={!name.trim() || Boolean(busy)}
              onClick={() => void create()}
            >
              {t("workspace.git.create_branch")}
            </button>
          </div>
          <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-base-content/70">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={checkoutNew}
              onChange={(event) => setCheckoutNew(event.target.checked)}
            />
            {t("workspace.git.checkout_new_branch")}
          </label>
        </div>

        <div className="mt-1 flex justify-end">
          <button type="button" className="btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
