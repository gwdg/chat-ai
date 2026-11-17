import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import { useAgents } from "../../agents/agentStore";
import type { WorkspaceMountRow } from "../../db/dbTypes";
import { baseName } from "../../workspace/paths";
import { folderName } from "../../workspace/folders";
import { formatBytes } from "../../utils/formatBytes";
import { parsePublicGitUrl } from "../../workspace/importProject";
import {
  CloneIntoWorkspaceError,
  cloneIntoWorkspace,
} from "../../workspace/cloneIntoWorkspace";
import type {
  CloneIntoWorkspacePlan,
  CloneIntoWorkspaceProgress,
  CloneIntoWorkspaceResult,
} from "../../workspace/cloneIntoWorkspace";
import { inspectMountTarget } from "./mountTarget";

const repoNameFromUrl = (value: string) => {
  try {
    const url = new URL(value);
    return baseName(url.pathname.replace(/\.git$/i, "")) || "repository";
  } catch {
    return "repository";
  }
};

type CloneRepositoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string;
  mounts?: WorkspaceMountRow[];
  onAdded?: (result: CloneIntoWorkspaceResult) => void;
};

export default function CloneRepositoryModal({
  isOpen,
  onClose,
  workspaceId,
  mounts = [],
  onAdded,
}: CloneRepositoryModalProps) {
  const { t } = useTranslation();
  const agents = useAgents();
  const localAgents = useMemo(
    () => agents.filter((agent) => agent.local !== false && agent.sessionId),
    [agents],
  );

  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [folder, setFolder] = useState("");
  const [folderEdited, setFolderEdited] = useState(false);
  const [cloneAgentId, setCloneAgentId] = useState("");
  const [phase, setPhase] = useState<"form" | "review" | "copying">("form");
  const [plan, setPlan] = useState<CloneIntoWorkspacePlan | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reviewResolver = useRef<((proceed: boolean) => void) | null>(null);
  const closed = useRef(false);

  useEffect(() => {
    if (isOpen) closed.current = false;
  }, [isOpen]);

  useEffect(() => {
    if (!cloneAgentId && localAgents[0]?.id) {
      setCloneAgentId(localAgents[0].id);
    }
    if (cloneAgentId && !localAgents.some((agent) => agent.id === cloneAgentId)) {
      setCloneAgentId(localAgents[0]?.id ?? "");
    }
  }, [cloneAgentId, localAgents]);

  const suggestedFolder = useMemo(() => {
    if (!url.trim()) return "";
    try {
      return repoNameFromUrl(parsePublicGitUrl(url));
    } catch {
      return "";
    }
  }, [url]);

  const targetPreview = useMemo(() => {
    try {
      const name = folderName(folder.trim() || suggestedFolder, {
        maxLength: 120,
        rejectEmpty: true,
      });
      return `/${name}`;
    } catch {
      return "";
    }
  }, [folder, suggestedFolder]);

  useEffect(() => {
    if (!folderEdited) setFolder(suggestedFolder);
  }, [folderEdited, suggestedFolder]);

  const agent = localAgents.find((item) => item.id === cloneAgentId);

  const reset = () => {
    reviewResolver.current = null;
    setUrl("");
    setBranch("");
    setFolder("");
    setFolderEdited(false);
    setCloneAgentId("");
    setPhase("form");
    setPlan(null);
    setProgress("");
    setError("");
    setBusy(false);
  };

  const close = () => {
    if (busy) return;
    closed.current = true;
    const resolve = reviewResolver.current;
    reviewResolver.current = null;
    resolve?.(false);
    reset();
    onClose();
  };

  const progressText = (event: CloneIntoWorkspaceProgress) => {
    if (event.step === "clone") return t("workspace.clone_progress_clone");
    if (event.step === "manifest") return t("workspace.clone_progress_manifest");
    if (event.step === "measure") return t("workspace.clone_progress_measure");
    if (event.step === "mount") return t("workspace.clone_progress_mount");
    if (event.files) {
      return t("workspace.clone_progress_files", {
        files: event.files,
        size: formatBytes(event.bytes ?? 0, { fixedDigits: true, maxUnit: 3 }),
      });
    }
    return t("workspace.clone_progress_copy");
  };

  const submit = async () => {
    if (busy || !workspaceId) return;
    setError("");
    setBusy(true);
    try {
      const targetUrl = parsePublicGitUrl(url);
      const targetFolder = folderName(folder.trim() || suggestedFolder, {
        maxLength: 120,
        rejectEmpty: true,
      });
      if (!agent) throw new Error(t("workspace.clone_agent_required"));
      const problem = await inspectMountTarget({
        workspaceId,
        path: `/${targetFolder}`,
        mountedPaths: mounts.map((mount) => mount.path),
      });
      if (problem) throw new Error(t(problem.key, problem.values));

      const result = await cloneIntoWorkspace({
        workspaceId,
        agent,
        url: targetUrl,
        branch,
        folder: targetFolder,
        target: "browser",
        onProgress: (event) => setProgress(progressText(event)),
        beforeCopy: (prepared) => {
          setPlan(prepared);
          setPhase("review");
          setProgress("");
          setBusy(false);
          return new Promise<boolean>((resolve) => {
            reviewResolver.current = resolve;
          });
        },
      });
      if (closed.current) return;
      onAdded?.(result);
      reset();
      onClose();
    } catch (event) {
      if (
        event instanceof CloneIntoWorkspaceError &&
        event.code === "cancelled"
      ) {
        if (!closed.current) setPhase("form");
        return;
      }
      if (closed.current) return;
      setPhase("form");
      setPlan(null);
      setError(event instanceof Error ? event.message : String(event));
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const confirmCopy = () => {
    if (busy || !reviewResolver.current) return;
    setPhase("copying");
    setBusy(true);
    setProgress(t("workspace.clone_progress_copy"));
    const resolve = reviewResolver.current;
    reviewResolver.current = null;
    resolve(true);
  };

  const reviewing = (phase === "review" || phase === "copying") && !!plan;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={close}
      titleKey={reviewing ? "workspace.clone_confirm_title" : "workspace.mode_clone"}
      maxWidth="max-w-xl"
    >
      <div className="flex flex-col gap-3 pb-2 text-sm">
        {reviewing && plan ? (
          <>
            <p className="text-xs text-base-content/70">
              {t("workspace.clone_confirm_intro")}
            </p>
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-base-content/80">
              {t("workspace.clone_manifest_warning")}
            </div>
            <div className="rounded-xl border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-semibold">{t("workspace.clone_summary_repo")}</p>
              <p className="mt-1 break-all font-mono text-[11px]">{url.trim()}</p>
              <p className="text-[11px] text-base-content/60">
                {branch.trim() || t("workspace.clone_default_branch")} → {plan.path}
              </p>
              <p className="text-[11px] text-base-content/60">
                {t("workspace.clone_summary_files", {
                  files: plan.measure.files,
                  size: ` · ${formatBytes(plan.measure.bytes, {
                    fixedDigits: true,
                    maxUnit: 3,
                  })}`,
                })}
              </p>
              <p className="mt-1 text-[11px] text-base-content/60">
                {plan.manifest
                  ? t("workspace.clone_manifest_present")
                  : t("workspace.clone_manifest_none")}
              </p>
            </div>
            {error && <p className="text-xs text-error">{error}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className="btn" onClick={close} disabled={busy}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={confirmCopy}
                disabled={busy}
              >
                {t("workspace.clone_review_action")}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.clone_repo_url")}
              </span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.org/team/repo.git"
                aria-label={t("workspace.clone_repo_url")}
                className="input input-bordered w-full"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-base-content/70">
                  {t("workspace.clone_branch")}
                </span>
                <input
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  aria-label={t("workspace.clone_branch")}
                  className="input input-bordered w-full"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-base-content/70">
                  {t("workspace.clone_folder")}
                </span>
                <input
                  value={folder}
                  onChange={(event) => {
                    setFolder(event.target.value);
                    setFolderEdited(true);
                  }}
                  placeholder={suggestedFolder || t("workspace.clone_folder")}
                  aria-label={t("workspace.clone_folder")}
                  className="input input-bordered w-full"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.clone_agent")}
              </span>
              <select
                value={cloneAgentId}
                onChange={(event) => setCloneAgentId(event.target.value)}
                disabled={localAgents.length === 0}
                aria-label={t("workspace.clone_agent")}
                className="select select-bordered w-full"
              >
                {localAgents.length === 0 ? (
                  <option value="">{t("workspace.clone_no_agent")}</option>
                ) : (
                  localAgents.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name || item.id}
                    </option>
                  ))
                )}
              </select>
            </label>
            {localAgents.length === 0 && (
              <p className="text-xs text-warning">{t("workspace.clone_no_agent")}</p>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.clone_target")}
              </span>
              <p className="rounded-lg border border-base-300 px-3 py-2 text-sm">
                {t("workspace.clone_target_browser")}
              </p>
              <p className="text-xs leading-relaxed text-base-content/60">
                {t("workspace.clone_browser_hint")}
              </p>
              {targetPreview && (
                <p className="truncate font-mono text-[11px] text-base-content/50">
                  {targetPreview}
                </p>
              )}
            </div>

            {progress && (
              <p className="text-xs text-base-content/60">{progress}</p>
            )}
            {error && <p className="text-xs text-error">{error}</p>}

            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className="btn" onClick={close} disabled={busy}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={submit}
                disabled={busy || !agent || !url.trim()}
              >
                {t("workspace.clone_prepare")}
              </button>
            </div>
          </>
        )}
      </div>
    </BaseModal>
  );
}
