import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import {
  Cube,
  DataBase,
  Folder,
  GitRepo,
  Plug,
  TrashCan,
} from "@carbon/icons-react";

import BaseModal from "../BaseModal";
import SourcePalette from "../../components/Workspace/SourcePalette";
import {
  addSource,
  addWorkspaceMount,
  createWorkspace,
  getSourceHandle,
  listCloneTargets,
} from "../../db/workspaceDb";
import { useAgents } from "../../agents/agentStore";
import { hasLocalMcpServerValue } from "../../agent/mcp";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";
import { useImportConversation } from "../../hooks/useImportConversation";
import { useUpdateModelsData } from "../../hooks/useUpdateModelsData";
import { folderName } from "../../workspace/folders";
import { baseName } from "../../workspace/paths";
import { parsePublicGitUrl } from "../../workspace/importProject";
import { cloneIntoWorkspace } from "../../workspace/cloneIntoWorkspace";
import { applyWorkspaceManifest } from "../../workspace/applyWorkspaceManifest";
import {
  addLocalSource,
  pickDirectory,
} from "../../workspace/localWorkspace";
import { formatBytes } from "../../utils/formatBytes";

const repoNameFromUrl = (value) => {
  try {
    const url = new URL(value);
    return baseName(url.pathname.replace(/\.git$/i, "")) || "repository";
  } catch {
    return "repository";
  }
};

const rowId = () =>
  `source-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const sourceLabel = (row, t) => {
  if (row.kind === "local") {
    return row.label || row.handle?.name || t("workspace.kind_local");
  }
  if (row.kind === "git") {
    return row.folder || repoNameFromUrl(row.url) || t("workspace.kind_git");
  }
  return row.label || t("workspace.kind_mcp");
};

function IncludedSourceRow({ Icon, label }) {
  const { t } = useTranslation();
  return (
    <div className="mb-1 rounded-lg border border-base-300/70 bg-base-200/30 px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <Icon size={14} className="shrink-0 text-base-content/45" />
        <span className="truncate text-xs text-base-content/75">{label}</span>
        <span
          className="badge badge-ghost badge-xs ml-auto shrink-0 font-normal text-base-content/50"
          title={t("workspace.source_included_hint")}
        >
          {t("workspace.sources_included")}
        </span>
      </div>
    </div>
  );
}

function PendingSourceRow({
  row,
  agents,
  targets,
  onUpdate,
  onRemove,
  onGitUrlChange,
  onGitLocalTarget,
  onContinueReview,
  onDiscardReview,
}) {
  const { t } = useTranslation();
  const Icon = row.kind === "git" ? GitRepo : row.kind === "mcp" ? Plug : Folder;
  const kindLabel =
    row.kind === "git"
      ? t("workspace.kind_git")
      : row.kind === "mcp"
        ? t("workspace.kind_mcp")
        : t("workspace.kind_local");
  const title = sourceLabel(row, t);
  const selectedAgent = agents.find((agent) => agent.id === row.agentId);

  const statusText = () => {
    if (row.status === "done") return t("workspace.row_done");
    if (row.status === "failed") {
      return t("workspace.row_failed", {
        message: row.message || "",
      });
    }
    if (row.status === "working") {
      const working = t("workspace.row_working");
      return row.progress ? `${working} · ${row.progress}` : working;
    }
    return t("workspace.row_pending");
  };

  const statusClass =
    row.status === "done"
      ? "text-success"
      : row.status === "failed"
        ? "text-error"
        : row.status === "working"
          ? "text-accent"
          : "text-base-content/50";

  return (
    <div
      data-testid={`pending-source-${row.id}`}
      className="mb-1 rounded-lg border border-base-300 px-2 py-1.5"
    >
      <div className="flex items-start gap-2">
        <Icon size={14} className="mt-0.5 shrink-0 text-base-content/55" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs font-medium">{title}</span>
            <span className="badge badge-ghost badge-xs shrink-0">
              {kindLabel}
            </span>
          </div>

          {row.kind === "local" && (
            <div className="mt-1 grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={row.label}
                onChange={(event) => onUpdate({ label: event.target.value })}
                placeholder={row.handle?.name || t("workspace.kind_local")}
                aria-label={t("workspace.source_label")}
                className="input input-bordered input-xs w-full"
              />
              <label className="flex items-center gap-1 whitespace-nowrap text-[11px] text-base-content/70">
                <input
                  type="checkbox"
                  checked={row.readOnly}
                  onChange={(event) =>
                    onUpdate({ readOnly: event.target.checked })
                  }
                  className="checkbox checkbox-xs"
                />
                <span>{t("workspace.source_read_only")}</span>
              </label>
            </div>
          )}

          {row.kind === "git" && (
            <div className="mt-1 flex flex-col gap-1">
              <input
                value={row.url}
                onChange={(event) => onGitUrlChange(event.target.value)}
                placeholder="https://example.org/team/repo.git"
                aria-label={t("workspace.clone_repo_url")}
                className="input input-bordered input-sm w-full font-mono text-[11px]"
              />
              <div className="grid gap-1 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] text-base-content/55">
                    {t("workspace.clone_folder")}
                  </span>
                  <input
                    value={row.folder}
                    onChange={(event) =>
                      onUpdate({
                        folder: event.target.value,
                        folderEdited: true,
                      })
                    }
                    placeholder={repoNameFromUrl(row.url)}
                    aria-label={t("workspace.clone_folder")}
                    className="input input-bordered input-xs w-full font-mono"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] text-base-content/55">
                    {t("workspace.clone_branch")}
                  </span>
                  <input
                    value={row.branch}
                    onChange={(event) => onUpdate({ branch: event.target.value })}
                    aria-label={t("workspace.clone_branch")}
                    className="input input-bordered input-xs w-full"
                  />
                </label>
              </div>
              {!agents.length && (
                <p className="text-[11px] text-warning">
                  {t("workspace.clone_no_agent")}
                </p>
              )}
              <details className="mt-0.5">
                <summary className="cursor-pointer text-[11px] text-base-content/55">
                  {t("workspace.advanced")}
                </summary>
                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] text-base-content/55">
                      {t("workspace.clone_agent")}
                    </span>
                    <select
                      value={row.agentId}
                      onChange={(event) =>
                        onUpdate({ agentId: event.target.value })
                      }
                      disabled={!agents.length}
                      aria-label={t("workspace.clone_agent")}
                      className="select select-bordered select-xs w-full"
                    >
                      {agents.length === 0 ? (
                        <option value="">{t("workspace.clone_no_agent")}</option>
                      ) : (
                        agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name || agent.id}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] text-base-content/55">
                      {t("workspace.clone_target")}
                    </span>
                    <select
                      value={row.targetMode}
                      onChange={(event) => {
                        if (event.target.value === "local") {
                          onGitLocalTarget();
                          return;
                        }
                        onUpdate({ targetMode: event.target.value });
                      }}
                      aria-label={t("workspace.clone_target")}
                      className="select select-bordered select-xs w-full"
                    >
                      <option value="browser">
                        {t("workspace.clone_target_browser")}
                      </option>
                      <option value="agent">
                        {t("workspace.clone_target_agent", {
                          name: selectedAgent?.name || "",
                        })}
                      </option>
                      <option value="local">
                        {row.targetHandle
                          ? t("workspace.clone_target_local_selected", {
                              name: row.targetHandle.name,
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
                </div>
              </details>
              {row.formError && (
                <p className="text-[11px] text-error">{row.formError}</p>
              )}
            </div>
          )}

          {row.kind === "mcp" && (
            <div className="mt-1 grid gap-1">
              <input
                value={row.endpoint}
                onChange={(event) => onUpdate({ endpoint: event.target.value })}
                placeholder="http://localhost:9000/mcp"
                aria-label={t("workspace.mcp_endpoint")}
                className="input input-bordered input-sm w-full font-mono text-[11px]"
              />
              <div className="grid gap-1 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] text-base-content/55">
                    {t("workspace.mcp_transport")}
                  </span>
                  <select
                    value={row.transport}
                    onChange={(event) =>
                      onUpdate({ transport: event.target.value })
                    }
                    aria-label={t("workspace.mcp_transport")}
                    className="select select-bordered select-xs w-full"
                  >
                    <option value="streamable-http">Streamable HTTP</option>
                    <option value="sse">SSE</option>
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] text-base-content/55">
                    {t("workspace.mcp_allowlist")}
                  </span>
                  <input
                    value={row.allowlist}
                    onChange={(event) =>
                      onUpdate({ allowlist: event.target.value })
                    }
                    aria-label={t("workspace.mcp_allowlist")}
                    className="input input-bordered input-xs w-full"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={row.status === "working" && row.phase !== "review"}
          title={t("workspace.clone_row_remove")}
          aria-label={t("workspace.clone_row_remove")}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/40 transition hover:bg-base-200 hover:text-error disabled:opacity-40"
        >
          <TrashCan size={12} />
        </button>
      </div>

      <p
        data-testid={`source-row-status-${row.id}`}
        aria-live="polite"
        className={`mt-1 text-[11px] ${statusClass}`}
      >
        {statusText()}
      </p>

      {row.phase === "review" && row.plan && (
        <div className="mt-1 rounded-lg border border-warning/40 bg-warning/10 p-2 text-[11px] leading-relaxed text-base-content/80">
          <p>{t("workspace.clone_manifest_warning")}</p>
          <div className="mt-1 rounded-md border border-base-300 bg-base-100/70 p-2">
            <p className="break-all font-mono">{row.url.trim()}</p>
            <p className="text-base-content/60">
              {row.branch.trim() || t("workspace.clone_default_branch")} →{" "}
              {row.plan.path}
            </p>
            <p className="text-base-content/60">
              {t("workspace.clone_summary_files", {
                files: row.plan.measure.files,
                size: ` · ${formatBytes(row.plan.measure.bytes, {
                  fixedDigits: true,
                  maxUnit: 3,
                })}`,
              })}
            </p>
            <p className="text-base-content/60">
              {row.plan.manifest
                ? t("workspace.clone_manifest_present")
                : t("workspace.clone_manifest_none")}
            </p>
          </div>
          {row.plan.manifest?.agent && (
            <label className="mt-1 flex flex-col gap-0.5">
              <span className="text-[10px] text-base-content/55">
                {t("workspace.clone_agent_connection")}
              </span>
              <select
                value={row.manifestAgentConnectionId || row.agentId}
                onChange={(event) =>
                  onUpdate({
                    manifestAgentConnectionId: event.target.value,
                  })
                }
                aria-label={t("workspace.clone_agent_connection")}
                className="select select-bordered select-xs w-full"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name || agent.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-2 flex justify-end gap-1">
            <button
              type="button"
              onClick={onDiscardReview}
              className="btn btn-xs"
            >
              {t("workspace.clone_discard")}
            </button>
            <button
              type="button"
              onClick={onContinueReview}
              className="btn btn-accent btn-xs"
            >
              {t("workspace.clone_continue")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateWorkspaceModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userSettings = useSelector(selectUserSettings);
  const importConversation = useImportConversation();
  const modelsData = useUpdateModelsData();
  const agents = useAgents();
  const localAgents = useMemo(
    () => agents.filter((agent) => agent.local !== false && agent.sessionId),
    [agents],
  );

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [targets, setTargets] = useState([]);
  const [sourceError, setSourceError] = useState("");
  const [workspaceId, setWorkspaceId] = useState(null);
  const [failed, setFailed] = useState(false);
  const rowsRef = useRef([]);
  const reviewResolvers = useRef(new Map());

  const localMcpEnabled =
    userSettings?.tools?.mcp === true &&
    hasLocalMcpServerValue(userSettings?.mcp_servers);

  const localBlocker =
    window.isSecureContext === false
      ? t("workspace.local_insecure")
      : !("showDirectoryPicker" in window)
        ? t("workspace.local_unsupported")
        : "";

  const reviewing = rows.some((row) => row.phase === "review");

  const setRowsNow = (updater) => {
    const next =
      typeof updater === "function" ? updater(rowsRef.current) : updater;
    rowsRef.current = next;
    setRows(next);
  };

  useEffect(() => {
    if (!isOpen) return;
    void listCloneTargets()
      .then(setTargets)
      .catch(() => setTargets([]));
  }, [isOpen]);

  useEffect(() => {
    const first = localAgents[0]?.id ?? "";
    setRowsNow((previous) =>
      previous.map((row) =>
        row.kind === "git" &&
        (!row.agentId || !localAgents.some((agent) => agent.id === row.agentId))
          ? { ...row, agentId: first }
          : row,
      ),
    );
  }, [localAgents]);

  const reset = useCallback(() => {
    reviewResolvers.current.clear();
    setName("");
    setError("");
    setBusy(false);
    rowsRef.current = [];
    setRows([]);
    setSourceError("");
    setWorkspaceId(null);
    setFailed(false);
  }, []);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const close = () => {
    if (busy) return;
    for (const resolve of reviewResolvers.current.values()) resolve(false);
    reviewResolvers.current.clear();
    reset();
    onClose();
  };

  const updateRow = (id, patch) => {
    setRowsNow((previous) =>
      previous.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (id) => {
    const resolve = reviewResolvers.current.get(id);
    if (resolve) {
      reviewResolvers.current.delete(id);
      resolve(false);
    }
    setRowsNow((previous) => previous.filter((row) => row.id !== id));
  };

  const pickLocalHandle = () =>
    pickDirectory({
      mode: "readwrite",
      insecureMessage: t("workspace.local_insecure"),
      unsupportedMessage: t("workspace.local_unsupported"),
    });

  const addLocalRow = async () => {
    if (localBlocker) {
      setSourceError(localBlocker);
      return;
    }
    setSourceError("");
    try {
      const handle = await pickLocalHandle();
      setRowsNow((previous) => [
        ...previous,
        {
          id: rowId(),
          kind: "local",
          label: handle.name,
          handle,
          readOnly: false,
          status: "pending",
          progress: "",
          message: "",
        },
      ]);
    } catch (event) {
      if (event?.name === "AbortError") {
        setSourceError(t("workspace.local_aborted"));
        return;
      }
      setSourceError(event instanceof Error ? event.message : String(event));
    }
  };

  const addGitRow = () => {
    setRowsNow((previous) => [
      ...previous,
      {
        id: rowId(),
        kind: "git",
        url: "",
        branch: "",
        folder: "",
        folderEdited: false,
        agentId: localAgents[0]?.id ?? "",
        manifestAgentConnectionId: "",
        targetMode: "browser",
        targetHandle: null,
        status: "pending",
        progress: "",
        message: "",
        formError: "",
        plan: null,
        phase: "form",
      },
    ]);
  };

  const addMcpRow = () => {
    setRowsNow((previous) => [
      ...previous,
      {
        id: rowId(),
        kind: "mcp",
        label: t("workspace.kind_mcp"),
        endpoint: "",
        transport: "streamable-http",
        allowlist: "",
        status: "pending",
        progress: "",
        message: "",
      },
    ]);
  };

  const pickSource = (action) => {
    if (action === "local") void addLocalRow();
    if (action === "git") addGitRow();
    if (action === "mcp") addMcpRow();
  };

  const changeGitUrl = (id, value) => {
    const suggested = repoNameFromUrl(value);
    setRowsNow((previous) =>
      previous.map((row) =>
        row.id === id
          ? {
              ...row,
              url: value,
              ...(row.folderEdited ? {} : { folder: suggested }),
            }
          : row,
      ),
    );
    if (!name.trim()) setName(suggested);
  };

  const pickGitLocalTarget = async (id) => {
    if (localBlocker) {
      updateRow(id, { formError: localBlocker });
      return;
    }
    try {
      const handle = await pickLocalHandle();
      updateRow(id, {
        targetMode: "local",
        targetHandle: handle,
        formError: "",
      });
    } catch (event) {
      updateRow(id, {
        formError:
          event?.name === "AbortError"
            ? t("workspace.local_aborted")
            : event instanceof Error
              ? event.message
              : String(event),
      });
    }
  };

  const progressText = (row, event) => {
    if (event.step === "clone") return t("workspace.clone_progress_clone");
    if (event.step === "manifest") return t("workspace.clone_progress_manifest");
    if (event.step === "measure") return t("workspace.clone_progress_measure");
    if (event.step === "mount") return t("workspace.clone_progress_mount");
    if (row.targetMode === "agent") {
      return t("workspace.clone_progress_agent_storage");
    }
    if (event.files) {
      return t("workspace.clone_progress_files", {
        files: event.files,
        size: formatBytes(event.bytes ?? 0, {
          fixedDigits: true,
          maxUnit: 3,
        }),
      });
    }
    return t("workspace.clone_progress_copy");
  };

  const continueReview = (id) => {
    const resolve = reviewResolvers.current.get(id);
    if (!resolve) return;
    reviewResolvers.current.delete(id);
    const row = rowsRef.current.find((item) => item.id === id);
    updateRow(id, {
      phase: "copying",
      progress:
        row?.targetMode === "agent"
          ? t("workspace.clone_progress_agent_storage")
          : t("workspace.clone_progress_copy"),
    });
    setBusy(true);
    resolve(true);
  };

  const discardReview = (id) => {
    const resolve = reviewResolvers.current.get(id);
    if (!resolve) return;
    reviewResolvers.current.delete(id);
    updateRow(id, { phase: "form", plan: null, progress: "" });
    setBusy(true);
    resolve(false);
  };

  const applyLocalRow = async (row, id) => {
    if (!row.handle) throw new Error(t("workspace.choose_folder_required"));
    const folder = folderName(row.handle.name, {
      maxLength: 120,
      rejectEmpty: true,
    });
    const sourceId = await addLocalSource({
      workspaceId: id,
      handle: row.handle,
      label: row.label.trim() || row.handle.name,
      readOnly: row.readOnly,
    });
    updateRow(row.id, { progress: t("workspace.clone_progress_mount") });
    await addWorkspaceMount({
      workspaceId: id,
      sourceId,
      sourcePath: "/",
      path: `/${folder}`,
      readOnly: row.readOnly,
    });
  };

  const applyMcpRow = async (row, id) => {
    if (!row.endpoint.trim()) throw new Error(t("workspace.mcp_required"));
    await addSource({
      workspaceId: id,
      kind: "mcp",
      label: row.label.trim() || t("workspace.kind_mcp"),
      config: {
        endpoint: row.endpoint.trim(),
        transport: row.transport,
        toolAllowlist: row.allowlist
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
      },
      status: "offline",
    });
  };

  const applyGitRow = async (row, id) => {
    const targetUrl = parsePublicGitUrl(row.url);
    const targetFolder = folderName(
      row.folder.trim() || repoNameFromUrl(targetUrl),
      { maxLength: 120, rejectEmpty: true },
    );
    const agent = localAgents.find((item) => item.id === row.agentId);
    if (!agent) throw new Error(t("workspace.clone_agent_required"));

    let target = "browser";
    if (row.targetMode === "agent") {
      target = { kind: "agent" };
    } else if (row.targetMode === "local") {
      if (!row.targetHandle) {
        throw new Error(t("workspace.clone_target_required"));
      }
      target = { kind: "local", handle: row.targetHandle };
    } else if (row.targetMode.startsWith("source:")) {
      const targetId = row.targetMode.slice("source:".length);
      const selected = targets.find((item) => item.id === targetId);
      if (!selected) throw new Error(t("workspace.clone_target_missing"));
      const handle =
        selected.kind === "local"
          ? await getSourceHandle(selected.id)
          : null;
      const sourceId = await addSource({
        workspaceId: id,
        kind: selected.kind,
        label: selected.label,
        config:
          selected.kind === "local"
            ? { handleKey: "" }
            : { ...(selected.source.config || {}) },
        capabilities: selected.source.capabilities,
        status: "offline",
        ...(handle ? { handle } : {}),
      });
      target = { sourceId };
    }

    let reviewedPlan = null;
    let result;
    try {
      result = await cloneIntoWorkspace({
        workspaceId: id,
        agent,
        url: targetUrl,
        branch: row.branch,
        folder: targetFolder,
        target,
        onProgress: (event) => {
          updateRow(row.id, {
            status: "working",
            progress: progressText(row, event),
          });
        },
        beforeCopy: (plan) => {
          reviewedPlan = plan;
          updateRow(row.id, {
            phase: "review",
            plan,
            status: "working",
            progress: "",
          });
          setBusy(false);
          return new Promise((resolve) => {
            reviewResolvers.current.set(row.id, resolve);
          });
        },
      });
    } catch (event) {
      // A discarded review is not a failure: keep the code so applyRows can put the row back.
      throw event;
    }

    updateRow(row.id, { phase: "copying", progress: "" });
    const manifest = reviewedPlan?.manifest;
    const latestRow =
      rowsRef.current.find((item) => item.id === row.id) || row;
    if (
      manifest &&
      typeof manifest === "object" &&
      Object.keys(manifest).length > 0
    ) {
      await applyWorkspaceManifest({
        workspaceId: id,
        manifest,
        connection: agent,
        localAgents,
        modelsData,
        manifestAgentConnectionId:
          latestRow.manifestAgentConnectionId || undefined,
        importConversation,
        onProgress: (step) =>
          updateRow(row.id, {
            progress:
              step === "agent"
                ? t("workspace.clone_progress_agent")
                : t("workspace.clone_progress_chats"),
          }),
      });
    }
    return result;
  };

  const applyRows = async (id) => {
    for (const pendingRow of [...rowsRef.current]) {
      // Re-read: a previous attempt may already have finished this row (retry after a failure).
      const row = rowsRef.current.find((item) => item.id === pendingRow.id);
      if (!row || row.status === "done") continue;
      updateRow(row.id, {
        status: "working",
        progress: "",
        message: "",
        phase: "form",
      });
      try {
        if (row.kind === "local") await applyLocalRow(row, id);
        if (row.kind === "mcp") await applyMcpRow(row, id);
        if (row.kind === "git") await applyGitRow(row, id);
        updateRow(row.id, {
          status: "done",
          progress: "",
          phase: "done",
        });
      } catch (event) {
        if (event?.code === "cancelled") {
          updateRow(row.id, {
            status: "pending",
            progress: "",
            phase: "form",
            plan: null,
            message: t("workspace.clone_discarded"),
          });
          return false;
        }
        updateRow(row.id, {
          status: "failed",
          progress: "",
          phase: "failed",
          message: event instanceof Error ? event.message : String(event),
        });
        setFailed(true);
        return false;
      }
    }
    return true;
  };

  const createError = (event) => {
    const message = event instanceof Error ? event.message : String(event);
    return message.includes("already exists")
      ? t("workspace.name_taken")
      : message.includes("required")
        ? t("workspace.name_required")
        : t("workspace.create_error");
  };

  const create = async () => {
    if (busy || reviewing || !name.trim()) return;
    setBusy(true);
    setError("");
    setSourceError("");
    setFailed(false);
    let id = workspaceId;
    try {
      if (!id) {
        id = await createWorkspace(name.trim());
        setWorkspaceId(id);
      }
      const complete = await applyRows(id);
      if (complete) {
        onClose();
        navigate(`/workspace/${id}`);
      }
    } catch (event) {
      setError(createError(event));
    } finally {
      setBusy(false);
    }
  };

  const openWorkspace = () => {
    if (!workspaceId) return;
    const id = workspaceId;
    reset();
    onClose();
    navigate(`/workspace/${id}`);
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={close}
      titleKey="workspace.create_title"
      maxWidth="max-w-2xl"
    >
      <div className="flex flex-col gap-3 pb-2 text-sm">
        <label className="flex flex-col gap-1">
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

        {error && <p className="text-xs text-error">{error}</p>}

        <section className="rounded-xl border border-base-300 bg-base-100">
          <header className="flex items-center justify-between border-b border-base-300 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
              {t("workspace.sources")}
            </span>
          </header>
          <div className="p-1.5">
            <IncludedSourceRow
              Icon={DataBase}
              label={t("workspace.source_browser")}
            />
            <IncludedSourceRow
              Icon={Cube}
              label={t("workspace.kind_arcana-filesystem")}
            />
            {rows.map((row) => (
              <PendingSourceRow
                key={row.id}
                row={row}
                agents={localAgents}
                targets={targets}
                onUpdate={(patch) => updateRow(row.id, patch)}
                onRemove={() => removeRow(row.id)}
                onGitUrlChange={(value) => changeGitUrl(row.id, value)}
                onGitLocalTarget={() => void pickGitLocalTarget(row.id)}
                onContinueReview={() => continueReview(row.id)}
                onDiscardReview={() => discardReview(row.id)}
              />
            ))}
          </div>
          <SourcePalette
            mcpEnabled={localMcpEnabled}
            onPick={pickSource}
            showLabel
            className="mt-1 border-t border-base-300 px-1.5 pt-1.5 pb-1"
          />
          {localBlocker && (
            <p className="px-3 pb-2 text-[11px] leading-relaxed text-error">
              {localBlocker}
            </p>
          )}
          {sourceError && sourceError !== localBlocker && (
            <p className="px-3 pb-2 text-[11px] leading-relaxed text-error">
              {sourceError}
            </p>
          )}
        </section>

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" className="btn" onClick={close} disabled={busy}>
            {t("common.cancel")}
          </button>
          {workspaceId && failed ? (
            <button
              type="button"
              className="btn btn-accent"
              onClick={openWorkspace}
              disabled={busy}
            >
              {t("workspace.open_workspace")}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-accent"
              onClick={create}
              disabled={busy || reviewing || !name.trim()}
            >
              {busy ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  {t("workspace.create_applying")}
                </>
              ) : (
                t("workspace.create_workspace")
              )}
            </button>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
