import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import BaseModal from "../BaseModal";
import {
  addSource,
  addWorkspaceMount,
  attachWorkspaceAgent,
  attachWorkspaceChat,
  createWorkspace,
  deleteWorkspace,
  getSourceHandle,
  getWorkspaceSource,
  listCloneTargets,
  updateWorkspace,
} from "../../db/workspaceDb";
import { addAgent, removeAgent, useAgents } from "../../agents/agentStore";
import {
  createOpencodeSession,
  deleteOpencodeSession,
  putOpencodeInstructionEntry,
  setOpencodeModel,
} from "../../apis/opencodeAgents";
import { createProvider } from "../../workspace/providers";
import { createWorkspaceRootProvider } from "../../workspace/workspaceRoot";
import { defaultCapabilities } from "../../workspace/capabilities";
import { useImportConversation } from "../../hooks/useImportConversation";
import { useUpdateModelsData } from "../../hooks/useUpdateModelsData";
import { useToast } from "../../hooks/useToast";
import { deleteConversation, newId } from "../../db";
import { baseName, joinPath } from "../../workspace/paths";
import { formatBytes } from "../../utils/formatBytes";
import { folderName } from "../../workspace/folders";
import {
  addLocalSource,
  createLocalWorkspace,
  pickDirectory,
} from "../../workspace/localWorkspace";
import {
  cleanupAgentClone,
  cloneId,
  cloneRepositoryWithAgent,
  copyAgentProjectToProvider,
  measureAgentProject,
  moveAgentCloneToTarget,
  parsePublicGitUrl,
  readManifestFromAgent,
} from "../../workspace/importProject";

const repoNameFromUrl = (value) => {
  try {
    const url = new URL(value);
    return baseName(url.pathname.replace(/\.git$/i, "")) || "repository";
  } catch {
    return "repository";
  }
};

export default function CreateWorkspaceModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notifyError } = useToast();
  const importConversation = useImportConversation();
  const modelsData = useUpdateModelsData();
  const agents = useAgents();
  const localAgents = useMemo(
    () => agents.filter((agent) => agent.local !== false && agent.sessionId),
    [agents],
  );

  const [mode, setMode] = useState("empty");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("form");
  const [targets, setTargets] = useState([]);
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [folder, setFolder] = useState("");
  const [cloneAgentId, setCloneAgentId] = useState("");
  const [manifestAgentConnectionId, setManifestAgentConnectionId] =
    useState("");
  const [targetMode, setTargetMode] = useState("browser");
  const [targetHandle, setTargetHandle] = useState(null);
  const [plan, setPlan] = useState(null);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    void listCloneTargets()
      .then(setTargets)
      .catch(() => setTargets([]));
  }, []);

  useEffect(() => {
    if (!cloneAgentId && localAgents[0]?.id) {
      setCloneAgentId(localAgents[0].id);
    }
    if (
      cloneAgentId &&
      !localAgents.some((agent) => agent.id === cloneAgentId)
    ) {
      setCloneAgentId(localAgents[0]?.id ?? "");
    }
  }, [cloneAgentId, localAgents]);

  const reset = () => {
    setMode("empty");
    setName("");
    setError("");
    setBusy(false);
    setPhase("form");
    setUrl("");
    setBranch("");
    setFolder("");
    setCloneAgentId("");
    setManifestAgentConnectionId("");
    setTargetMode("browser");
    setTargetHandle(null);
    setPlan(null);
    setProgress("");
  };

  const close = () => {
    if (busy) return;
    if (plan?.tempBase) {
      void cleanupAgentClone(plan.agent, plan.tempBase);
    }
    reset();
    onClose();
  };

  const pickLocalTarget = async () => {
    try {
      const handle = await pickDirectory({
        unsupportedMessage: t("workspace.local_unsupported"),
      });
      setTargetHandle(handle);
      setTargetMode("local");
    } catch (event) {
      if (event?.name === "AbortError") return;
      throw event;
    }
  };

  const createEmpty = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const id = await createWorkspace(name);
      reset();
      onClose();
      navigate(`/workspace/${id}`);
    } catch (event) {
      const message = event instanceof Error ? event.message : String(event);
      setError(
        message.includes("already exists")
          ? t("workspace.name_taken")
          : message.includes("required")
            ? t("workspace.name_required")
            : t("workspace.create_error"),
      );
    } finally {
      setBusy(false);
    }
  };

  const mountLocalFolder = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      let handle = targetHandle;
      if (!handle) {
        handle = await pickDirectory({
          unsupportedMessage: t("workspace.local_unsupported"),
        });
      }
      const { workspaceId } = await createLocalWorkspace({ name, handle });
      reset();
      onClose();
      navigate(`/workspace/${workspaceId}`);
    } catch (event) {
      if (event?.name === "AbortError") return;
      setError(event instanceof Error ? event.message : String(event));
    } finally {
      setBusy(false);
    }
  };

  const prepareClone = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setProgress(t("workspace.clone_progress_clone"));
    let tempBase = null;
    let agent = null;
    try {
      if (!name.trim()) throw new Error(t("workspace.name_required"));
      const targetUrl = parsePublicGitUrl(url);
      const targetFolder = folderName(folder || repoNameFromUrl(targetUrl), {
        maxLength: 120,
        rejectEmpty: true,
      });
      agent = localAgents.find((item) => item.id === cloneAgentId);
      if (!agent) throw new Error(t("workspace.clone_agent_required"));
      if (targetMode === "local" && !targetHandle) {
        throw new Error(t("workspace.clone_target_required"));
      }
      if (targetMode === "agent" && !agent) {
        throw new Error(t("workspace.clone_agent_required"));
      }
      if (targetMode.startsWith("source:") && !targets.some((item) => `source:${item.id}` === targetMode)) {
        throw new Error(t("workspace.clone_target_required"));
      }

      const id = cloneId();
      const clone = await cloneRepositoryWithAgent({
        agent,
        url: targetUrl,
        branch,
        id,
      });
      tempBase = clone.tempBase;
      setProgress(t("workspace.clone_progress_manifest"));
      const manifest = await readManifestFromAgent(agent, clone.repoDir);
      setProgress(t("workspace.clone_progress_measure"));
      const measure = await measureAgentProject(agent, clone.repoDir);

      setPlan({
        agent,
        cloneAgentId: agent.id,
        tempBase,
        repoDir: clone.repoDir,
        manifest,
        measure,
        url: targetUrl,
        branch: branch.trim(),
        folder: targetFolder,
        workspaceName: manifest?.workspace?.name || name.trim(),
        targetMode,
        targetHandle,
      });
      setPhase("confirm");
    } catch (event) {
      if (tempBase && agent) await cleanupAgentClone(agent, tempBase);
      if (event?.name === "AbortError") return;
      setError(event instanceof Error ? event.message : String(event));
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const applyClone = async () => {
    if (!plan || busy) return;
    setBusy(true);
    setError("");
    setPhase("applying");
    let workspaceId = null;
    const chatIds = [];
    let agentId = null;
    let createdAgent = null;
    let agentTargetPath = null;
    try {
      workspaceId = await createWorkspace(plan.workspaceName);
      if (plan.manifest?.workspace?.icon || plan.manifest?.workspace?.color) {
        await updateWorkspace(workspaceId, {
          ...(plan.manifest.workspace.icon
            ? { icon: plan.manifest.workspace.icon }
            : {}),
          ...(plan.manifest.workspace.color
            ? { color: plan.manifest.workspace.color }
            : {}),
        });
      }

      let provider = null;
      let sourceId = null;
      const targetRoot = `/${plan.folder}`;
      if (plan.targetMode === "agent") {
        setProgress(t("workspace.clone_progress_agent_storage"));
        await moveAgentCloneToTarget({
          agent: plan.agent,
          repoDir: plan.repoDir,
          targetPath: plan.folder,
        });
        agentTargetPath = plan.folder;
        await cleanupAgentClone(plan.agent, plan.tempBase);
        sourceId = await addSource({
          workspaceId,
          kind: "agent",
          label: plan.agent.name,
          config: { agentId: plan.agent.id },
          capabilities: defaultCapabilities("agent"),
          readOnly: true,
          status: "offline",
        });
      } else if (plan.targetMode === "browser") {
        provider = createWorkspaceRootProvider(workspaceId);
      } else if (plan.targetMode === "local") {
        sourceId = await addLocalSource({
          workspaceId,
          label: plan.targetHandle.name,
          handle: plan.targetHandle,
        });
        const source = await getWorkspaceSource(sourceId);
        provider = createProvider(source);
      } else {
        const targetId = plan.targetMode.slice("source:".length);
        const target = targets.find((item) => item.id === targetId);
        if (!target) throw new Error(t("workspace.clone_target_missing"));
        const handle =
          target.kind === "local" ? await getSourceHandle(target.id) : null;
        sourceId = await addSource({
          workspaceId,
          kind: target.kind,
          label: target.label,
          config:
            target.kind === "local"
              ? { handleKey: "" }
              : { ...(target.source.config || {}) },
          capabilities: target.source.capabilities,
          status: "offline",
          ...(handle ? { handle } : {}),
        });
        const source = await getWorkspaceSource(sourceId);
        provider = createProvider(source);
      }

      if (plan.targetMode !== "agent") {
        const existing = await provider.stat(targetRoot).catch(() => null);
        if (existing) throw new Error(t("workspace.clone_target_exists"));

        setProgress(t("workspace.clone_progress_copy"));
        await copyAgentProjectToProvider({
          agent: plan.agent,
          repoDir: plan.repoDir,
          provider,
          targetRoot,
          onProgress: ({ files, bytes }) =>
            setProgress(
              t("workspace.clone_progress_files", {
                files,
                size: formatBytes(bytes, { fixedDigits: true, maxUnit: 3 }),
              }),
            ),
        });
      }

      if (plan.targetMode !== "browser") {
        await addWorkspaceMount({
          workspaceId,
          sourceId,
          sourcePath: targetRoot,
          path: targetRoot,
          ...(plan.targetMode === "agent" ? { readOnly: true } : {}),
        });
      }

      const manifestAgent = plan.manifest?.agent;
      if (manifestAgent) {
        const connection =
          localAgents.find(
            (item) => item.id === manifestAgentConnectionId,
          ) || plan.agent;
        setProgress(t("workspace.clone_progress_agent"));
        const session = await createOpencodeSession(
          connection,
          manifestAgent.sessionTitle ||
            `${manifestAgent.name || connection.name} agent`,
        );
        agentId = newId();
        const nextAgent = {
          id: agentId,
          projectId: connection.projectId,
          name: manifestAgent.name || connection.name,
          local: connection.local,
          serverUrl: connection.serverUrl,
          username: connection.username,
          password: connection.password,
          passwordSource: connection.passwordSource,
          sessionId: session.id,
          bridgeWorkspaceId: workspaceId,
          bridgeWritable: manifestAgent.bridgeWritable === true,
          bridgeMcp: manifestAgent.bridgeMcp === true,
          ...(manifestAgent.initialMessage
            ? {
                initialMessage: manifestAgent.initialMessage,
                initialMessageSessionId: session.id,
              }
            : {}),
        };
        addAgent(nextAgent);
        createdAgent = nextAgent;
        if (manifestAgent.initialMessage) {
          await putOpencodeInstructionEntry(
            connection,
            session.id,
            "chat-ai-manifest",
            manifestAgent.initialMessage,
          ).catch(() => {});
        }
        if (manifestAgent.model) {
          const model = (modelsData || []).find(
            (item) => item.id === manifestAgent.model,
          );
          if (model?.providerID) {
            await setOpencodeModel(nextAgent, session.id, {
              id: model.id,
              providerID: model.providerID,
            }).catch(() => {});
          }
        }
        await attachWorkspaceAgent(workspaceId, agentId);
      }

      if (plan.manifest?.chats?.length) {
        setProgress(t("workspace.clone_progress_chats"));
        for (const chat of plan.manifest.chats) {
          const chatId = await importConversation(
            {
              title: chat.title,
              settings: chat.settings,
              messages: chat.messages,
              ...(chat.folderName ? { folderName: chat.folderName } : {}),
            },
            true,
          );
          if (chatId) {
            chatIds.push(chatId);
            await attachWorkspaceChat(workspaceId, chatId);
          }
        }
      }

      await cleanupAgentClone(plan.agent, plan.tempBase);
      setPlan(null);
      reset();
      onClose();
      navigate(`/workspace/${workspaceId}`);
    } catch (event) {
      if (plan.tempBase) {
        await cleanupAgentClone(plan.agent, plan.tempBase);
      }
      for (const id of chatIds) {
        await deleteConversation(id).catch(() => {});
      }
      if (agentTargetPath) {
        await cleanupAgentClone(plan.agent, agentTargetPath);
      }
      if (createdAgent?.sessionId) {
        await deleteOpencodeSession(
          createdAgent,
          createdAgent.sessionId,
        ).catch(() => {});
      }
      if (agentId) removeAgent(agentId);
      if (workspaceId) await deleteWorkspace(workspaceId).catch(() => {});
      setError(event instanceof Error ? event.message : String(event));
      setPlan(null);
      setPhase("form");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const targetLabel = () => {
    if (plan?.targetMode === "browser") return t("workspace.clone_target_browser");
    if (plan?.targetMode === "agent") return t("workspace.clone_target_agent_selected", { name: plan.agent?.name || "" });
    if (plan?.targetMode === "local") return plan.targetHandle?.name || "Local folder";
    if (plan?.targetMode?.startsWith("source:")) {
      const id = plan.targetMode.slice("source:".length);
      const target = targets.find((item) => item.id === id);
      return target
        ? `${target.workspaceName} / ${target.label}`
        : t("workspace.clone_target_missing");
    }
    return "";
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={close}
      titleKey={phase === "confirm" ? "workspace.clone_confirm_title" : "workspace.create_title"}
      maxWidth="max-w-2xl"
    >
      {phase === "confirm" && plan ? (
        <div className="flex flex-col gap-3 pb-2 text-sm">
          <p className="text-xs text-base-content/70">
            {t("workspace.clone_confirm_intro")}
          </p>
          <div className="rounded-xl border border-base-300 bg-base-200/40 p-3">
            <p className="text-xs font-semibold">{t("workspace.clone_summary_repo")}</p>
            <p className="mt-1 break-all font-mono text-[11px]">{plan.url}</p>
            <p className="text-[11px] text-base-content/60">
              {plan.branch || t("workspace.clone_default_branch")} → /{plan.folder}
            </p>
            <p className="text-[11px] text-base-content/60">
              {t("workspace.clone_summary_files", {
                files: plan.measure.files,
                ...(plan.measure.bytes > 0
                  ? {
                      size: ` · ${formatBytes(plan.measure.bytes, {
                        fixedDigits: true,
                        maxUnit: 3,
                      })}`,
                    }
                  : { size: "" }),
              })}{" "}
              · {targetLabel()}
            </p>
          </div>
          <div className="rounded-xl border border-base-300 p-3">
            <p className="text-xs font-semibold">{t("workspace.clone_summary_workspace")}</p>
            <p className="text-[11px] text-base-content/70">{plan.workspaceName}</p>
          </div>
          {plan.manifest?.agent && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
              <p className="text-xs font-semibold">{t("workspace.clone_summary_agent")}</p>
              <p className="text-[11px] text-base-content/70">
                {plan.manifest.agent.name || plan.agent.name}
                {" · "}
                {plan.manifest.agent.sessionTitle || t("workspace.clone_new_session")}
              </p>
              <label className="mt-2 flex flex-col gap-1">
                <span className="text-[10px] text-base-content/60">
                  {t("workspace.clone_agent_connection")}
                </span>
                <select
                  value={manifestAgentConnectionId || plan.cloneAgentId}
                  onChange={(event) =>
                    setManifestAgentConnectionId(event.target.value)
                  }
                  className="select select-bordered select-sm"
                >
                  {localAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                  <option value="__configure" disabled>
                    {t("workspace.clone_configure_agent_soon")}
                  </option>
                  <option value="__remote" disabled>
                    {t("workspace.clone_remote_agent_soon")}
                  </option>
                </select>
              </label>
            </div>
          )}
          {plan.manifest?.chats?.length ? (
            <div className="rounded-xl border border-base-300 p-3">
              <p className="text-xs font-semibold">{t("workspace.clone_summary_chats")}</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-base-content/70">
                {plan.manifest.chats.map((chat, index) => (
                  <li key={`${chat.title}:${index}`}>
                    {chat.title}
                    {chat.folderName ? ` · ${chat.folderName}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {plan.manifest && (
            <p className="text-[11px] text-warning">
              {t("workspace.clone_manifest_warning")}
            </p>
          )}
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn" onClick={close} disabled={busy}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-accent"
              onClick={applyClone}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  {progress || t("workspace.clone_applying")}
                </>
              ) : (
                t("workspace.clone_confirm_action")
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-2">
          <div className="flex flex-wrap gap-1">
            {[
              ["empty", "workspace.mode_empty"],
              ["clone", "workspace.mode_clone"],
              ["local", "workspace.mode_local"],
            ].map(([value, key]) => (
              <button
                key={value}
                type="button"
                className={`btn btn-sm ${mode === value ? "btn-accent" : "btn-ghost"}`}
                onClick={() => {
                  setMode(value);
                  setError("");
                }}
              >
                {t(key)}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-base-content/70">
              {t("workspace.name_label")}
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("workspace.name_placeholder")}
              className="input input-bordered w-full"
              autoFocus
            />
          </label>

          {mode === "clone" && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-base-content/70">
                  {t("workspace.clone_repo_url")}
                </span>
                <input
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    if (!folder) setFolder(repoNameFromUrl(event.target.value));
                    if (!name) setName(repoNameFromUrl(event.target.value));
                  }}
                  placeholder="https://github.com/owner/repository.git"
                  className="input input-bordered w-full font-mono text-xs"
                />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium text-base-content/70">
                    {t("workspace.clone_branch")}
                  </span>
                  <input
                    value={branch}
                    onChange={(event) => setBranch(event.target.value)}
                    placeholder={t("workspace.clone_default_branch")}
                    className="input input-bordered w-full font-mono text-xs"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium text-base-content/70">
                    {t("workspace.clone_folder")}
                  </span>
                  <input
                    value={folder}
                    onChange={(event) => setFolder(event.target.value)}
                    placeholder="repository"
                    className="input input-bordered w-full font-mono text-xs"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-base-content/70">
                  {t("workspace.clone_agent")}
                </span>
                <select
                  value={cloneAgentId}
                  onChange={(event) => setCloneAgentId(event.target.value)}
                  className="select select-bordered w-full"
                >
                  {localAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                  <option value="__remote" disabled>
                    {t("workspace.clone_remote_agent_soon")}
                  </option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-base-content/70">
                  {t("workspace.clone_target")}
                </span>
                <select
                  value={targetMode}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "local") {
                      void pickLocalTarget().catch((reason) =>
                        setError(
                          reason instanceof Error ? reason.message : String(reason),
                        ),
                      );
                      return;
                    }
                    setTargetMode(value);
                  }}
                  className="select select-bordered w-full"
                >
                  <option value="browser">{t("workspace.clone_target_browser")}</option>
                  <option value="agent">
                    {t("workspace.clone_target_agent", {
                      name: localAgents.find((agent) => agent.id === cloneAgentId)?.name || "",
                    })}
                  </option>
                  <option value="local">
                    {targetHandle
                      ? t("workspace.clone_target_local_selected", {
                          name: targetHandle.name,
                        })
                      : t("workspace.clone_target_local")}
                  </option>
                  {targets.map((target) => (
                    <option key={target.id} value={`source:${target.id}`}>
                      {target.workspaceName} / {target.label}
                    </option>
                  ))}
                </select>
              </label>
              {!localAgents.length && (
                <p className="text-xs text-warning">
                  {t("workspace.clone_no_agent")}
                </p>
              )}
            </>
          )}

          {mode === "local" && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-base-content/60">
                {t("workspace.mount_local_hint")}
              </p>
              <button
                type="button"
                className="btn btn-sm justify-start"
                onClick={() =>
                  void pickLocalTarget().catch((reason) =>
                    setError(reason instanceof Error ? reason.message : String(reason)),
                  )
                }
              >
                {targetHandle
                  ? t("workspace.clone_target_local_selected", {
                      name: targetHandle.name,
                    })
                  : t("workspace.choose_local_folder")}
              </button>
            </div>
          )}

          {error && <p className="text-xs text-error">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn" onClick={close} disabled={busy}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-accent"
              disabled={busy || !name.trim()}
              onClick={
                mode === "empty"
                  ? createEmpty
                  : mode === "local"
                    ? mountLocalFolder
                    : prepareClone
              }
            >
              {busy ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  {progress || t("workspace.clone_preparing")}
                </>
              ) : mode === "clone" ? (
                t("workspace.clone_prepare")
              ) : mode === "local" ? (
                t("workspace.mount_local_action")
              ) : (
                t("workspace.create_workspace")
              )}
            </button>
          </div>
        </div>
      )}
    </BaseModal>
  );
}
