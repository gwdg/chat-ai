import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  Add,
  BareMetalServer as Server,
  Close,
  Cube,
  DataBase,
  Folder,
  GitRepo,
} from "@carbon/icons-react";

import BaseModal from "../BaseModal";
import { addSource, addWorkspaceMount, createWorkspace } from "../../db/workspaceDb";
import { useAgents } from "../../agents/agentStore";
import { useImportConversation } from "../../hooks/useImportConversation";
import { useUpdateModelsData } from "../../hooks/useUpdateModelsData";
import { folderName } from "../../workspace/folders";
import { baseName } from "../../workspace/paths";
import { parsePublicGitUrl } from "../../workspace/importProject";
import { cloneIntoWorkspace } from "../../workspace/cloneIntoWorkspace";
import { applyWorkspaceManifest } from "../../workspace/applyWorkspaceManifest";
import { addLocalSource, pickDirectory } from "../../workspace/localWorkspace";
import { defaultCapabilities } from "../../workspace/capabilities";
import {
  TOPIC_ICONS,
  topicIconById,
} from "../../components/Sidebar/topicIcons";
import {
  TOPIC_COLORS,
  topicColorById,
  withAlpha,
} from "../../components/Sidebar/topicColors";
import { formatBytes } from "../../utils/formatBytes";
import { getStorageStatus } from "../../utils/storagePersistence";
import { isFeatureEnabled } from "../../config/deployment";

const CAPTION = "text-[10px] font-semibold uppercase tracking-wider text-base-content/45";
const RAIL_ACTION =
  "flex w-full items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-2 py-1.5 text-left text-xs hover:border-accent/50 hover:bg-base-200";

const DEFAULT_WORKSPACE_ICON = "rocket";

function StorageCard({ icon: Icon, title, subtitle, status, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-base-300/70 bg-base-100 px-2 py-2">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-base-content">
            {title}
          </div>
          {subtitle && (
            <div className="mt-0.5 truncate text-[10px] text-base-content/50">
              {subtitle}
            </div>
          )}
          {status && (
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[10px] text-base-content/50">
              {status}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

const repoNameFromUrl = (value) => {
  try {
    const url = new URL(value);
    return baseName(url.pathname.replace(/\.git$/i, "")) || "repository";
  } catch {
    return "repository";
  }
};

const mcpRowName = (endpoint) => {
  try {
    return new URL(endpoint).host || endpoint;
  } catch {
    return endpoint;
  }
};

const rowId = () =>
  `source-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function CreateWorkspaceModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const importConversation = useImportConversation();
  const modelsData = useUpdateModelsData();
  const agents = useAgents();
  const localAgents = useMemo(
    () => agents.filter((agent) => agent.local !== false && agent.sessionId),
    [agents],
  );

  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [rows, setRowsState] = useState([]);
  const [railError, setRailError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [gitOpen, setGitOpen] = useState(false);
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("");
  const [gitAgentId, setGitAgentId] = useState("");
  const [gitError, setGitError] = useState("");
  const [icon, setIcon] = useState(DEFAULT_WORKSPACE_ICON);
  const [color, setColor] = useState(TOPIC_COLORS[0].id);
  const [iconOpen, setIconOpen] = useState(false);
  const [storage, setStorage] = useState(null);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [mcpEndpoint, setMcpEndpoint] = useState("");
  const [mcpTransport, setMcpTransport] = useState("streamable-http");
  const [mcpError, setMcpError] = useState("");

  const rowsRef = useRef([]);

  const setRows = (updater) => {
    const next = typeof updater === "function" ? updater(rowsRef.current) : updater;
    rowsRef.current = next;
    setRowsState(next);
  };

  const updateRow = (id, patch) =>
    setRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );

  useEffect(() => {
    if (!localAgents.length) {
      setGitAgentId("");
      return;
    }
    if (!localAgents.some((agent) => agent.id === gitAgentId)) {
      setGitAgentId(localAgents[0].id);
    }
  }, [gitAgentId, localAgents]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let alive = true;
    getStorageStatus()
      .then((status) => {
        if (alive) setStorage(status);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isOpen]);

  const uniquePath = (base) => {
    const used = new Set(rowsRef.current.map((row) => row.path));
    if (!used.has(base)) return base;
    let index = 2;
    while (used.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
  };

  const addRow = (row) => {
    setRows((previous) => [...previous, row]);
    if (!nameTouched && row.kind !== "mcp") setName(row.name);
  };

  const removeRow = (id) => setRows((previous) => previous.filter((row) => row.id !== id));

  const reset = () => {
    setName("");
    setNameTouched(false);
    setRows([]);
    setRailError("");
    setError("");
    setBusy(false);
    setWorkspaceId(null);
    setGitOpen(false);
    setGitUrl("");
    setGitBranch("");
    setGitAgentId("");
    setGitError("");
    setIcon(DEFAULT_WORKSPACE_ICON);
    setColor(TOPIC_COLORS[0].id);
    setIconOpen(false);
    setStorage(null);
    setMcpOpen(false);
    setMcpEndpoint("");
    setMcpTransport("streamable-http");
    setMcpError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickLocalFolder = async () => {
    if (busy) return;
    setRailError("");
    try {
      const handle = await pickDirectory({
        unsupportedMessage: t("workspace.local_unsupported"),
        insecureMessage: t("workspace.local_insecure"),
      });
      const folder = folderName(handle.name, { maxLength: 120, rejectEmpty: true });
      addRow({
        id: rowId(),
        kind: "local",
        name: handle.name,
        handle,
        path: uniquePath(`/${folder}`),
        status: "pending",
        progress: "",
        message: "",
      });
    } catch (event) {
      if (event?.name === "AbortError") return;
      setRailError(event instanceof Error ? event.message : String(event));
    }
  };

  const addGitRow = () => {
    const agent = localAgents.find((item) => item.id === gitAgentId);
    if (!agent) {
      setGitError(t("workspace.clone_agent_required"));
      return;
    }
    try {
      const url = parsePublicGitUrl(gitUrl);
      const folder = folderName(repoNameFromUrl(url), {
        maxLength: 120,
        rejectEmpty: true,
      });
      addRow({
        id: rowId(),
        kind: "git",
        name: folder,
        url,
        branch: gitBranch.trim(),
        agentId: agent.id,
        path: uniquePath(`/${folder}`),
        status: "pending",
        progress: "",
        message: "",
      });
      setGitOpen(false);
      setGitUrl("");
      setGitBranch("");
      setGitError("");
    } catch (event) {
      setGitError(event instanceof Error ? event.message : String(event));
    }
  };

  const addMcpRow = () => {
    const endpoint = mcpEndpoint.trim();
    if (!endpoint) {
      setMcpError(t("workspace.mcp_required"));
      return;
    }
    addRow({
      id: rowId(),
      kind: "mcp",
      name: mcpRowName(endpoint),
      endpoint,
      transport: mcpTransport,
      status: "pending",
      progress: "",
      message: "",
    });
    setMcpOpen(false);
    setMcpEndpoint("");
    setMcpTransport("streamable-http");
    setMcpError("");
  };

  const progressText = (event) => {
    if (event.step === "clone") return t("workspace.clone_progress_clone");
    if (event.step === "manifest") return t("workspace.clone_progress_manifest");
    if (event.step === "measure") return t("workspace.clone_progress_measure");
    if (event.step === "mount") return t("workspace.clone_progress_mount");
    if (event.files) {
      return t("workspace.clone_progress_files", {
        files: event.files.toLocaleString(),
        size: event.bytes
          ? formatBytes(event.bytes, { fixedDigits: true, maxUnit: 3 })
          : "",
      });
    }
    return t("workspace.clone_progress_copy");
  };

  const applyLocalRow = async (row, id) => {
    const sourceId = await addLocalSource({ workspaceId: id, handle: row.handle });
    updateRow(row.id, { progress: t("workspace.clone_progress_mount") });
    await addWorkspaceMount({
      workspaceId: id,
      sourceId,
      sourcePath: "/",
      path: row.path,
    });
  };

  const applyGitRow = async (row, id) => {
    const agent = localAgents.find((item) => item.id === row.agentId);
    let plan = null;
    await cloneIntoWorkspace({
      workspaceId: id,
      agent,
      url: row.url,
      branch: row.branch || undefined,
      folder: row.path.slice(1),
      target: "browser",
      onProgress: (event) => updateRow(row.id, { progress: progressText(event) }),
      beforeCopy: (pending) => {
        plan = pending;
        return true;
      },
    });

    const manifest = plan?.manifest;
    if (manifest && typeof manifest === "object" && Object.keys(manifest).length > 0) {
      await applyWorkspaceManifest({
        workspaceId: id,
        manifest,
        connection: agent,
        localAgents,
        modelsData,
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
  };

  const applyMcpRow = async (row, id) => {
    await addSource({
      workspaceId: id,
      kind: "mcp",
      label: row.name,
      config: {
        endpoint: row.endpoint,
        transport: row.transport,
        toolAllowlist: [],
      },
      status: "offline",
      capabilities: defaultCapabilities("mcp"),
    });
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
    if (busy || !name.trim()) return;
    setBusy(true);
    setError("");
    let id = workspaceId;
    try {
      if (!id) {
        id = await createWorkspace(name.trim(), { icon, color });
        setWorkspaceId(id);
      }
      for (const entry of [...rowsRef.current]) {
        const row = rowsRef.current.find((item) => item.id === entry.id);
        if (!row || row.status === "done") continue;
        updateRow(row.id, { status: "working", progress: "", message: "" });
        try {
          if (row.kind === "local") await applyLocalRow(row, id);
          else if (row.kind === "git") await applyGitRow(row, id);
          else await applyMcpRow(row, id);
          updateRow(row.id, { status: "done", progress: "" });
        } catch (event) {
          updateRow(row.id, {
            status: "failed",
            progress: "",
            message: event instanceof Error ? event.message : String(event),
          });
          return;
        }
      }
      reset();
      onClose();
      navigate(`/workspace/${id}`);
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

  const failed = rows.some((row) => row.status === "failed");

  const included = [
    { Icon: DataBase, label: t("workspace.source_browser_label") },
    { Icon: Cube, label: t("workspace.kind_arcana-filesystem") },
  ];
  const SelectedIcon = topicIconById(icon).Icon;
  const selectedColor = topicColorById(color);
  const localCount = rows.filter((row) => row.kind === "local").length;
  const gitCount = rows.filter((row) => row.kind === "git").length;
  const mcpCount = rows.filter((row) => row.kind === "mcp").length;
  const includedStatus = t("workspace.sources_included");
  const storageUsage =
    storage && storage.usage != null && storage.quota != null
      ? t("workspace.source_browser.usage", {
          used: formatBytes(storage.usage),
          quota: formatBytes(storage.quota),
        })
      : "";

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={close}
      titleKey="workspace.create_title"
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col gap-3 pb-2 text-sm">
        <div className="rounded-xl border border-base-300 bg-base-100 px-3 py-2">
          <div className="flex items-start gap-3">
            <button
              type="button"
              data-testid="create-workspace-icon"
              onClick={() => setIconOpen((open) => !open)}
              aria-label={t("folders.choose_icon")}
              aria-expanded={iconOpen}
              title={t("folders.choose_icon")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition hover:brightness-95"
              style={{
                backgroundColor: withAlpha(selectedColor.hex, 0.16),
                color: selectedColor.hex,
              }}
            >
              <SelectedIcon size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <label className="flex flex-col gap-1">
                <span className={CAPTION}>{t("workspace.name_label")}</span>
                <input
                  value={name}
                  onChange={(event) => {
                    setNameTouched(true);
                    setName(event.target.value);
                  }}
                  placeholder={t("workspace.name_placeholder")}
                  className="input input-bordered w-full"
                  autoFocus
                />
              </label>
              <p className="mt-0.5 text-[11px] text-base-content/60">
                {t("workspace.subtitle")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={CAPTION}>{t("folders.choose_color")}</span>
                {TOPIC_COLORS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    data-testid={`create-workspace-color-${option.id}`}
                    onClick={() => setColor(option.id)}
                    aria-label={option.label}
                    aria-pressed={color === option.id}
                    title={option.label}
                    className={`h-5 w-5 rounded-full transition ${
                      color === option.id
                        ? "ring-2 ring-accent ring-offset-2 ring-offset-base-100"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: option.hex }}
                  />
                ))}
              </div>
            </div>
          </div>
          {iconOpen && (
            <div className="mt-2 flex flex-col gap-1 border-t border-base-300/70 pt-2">
              <span className={CAPTION}>{t("folders.choose_icon")}</span>
              <div className="grid max-h-48 grid-cols-7 gap-1 overflow-y-auto">
                {TOPIC_ICONS.map((item) => {
                  const Icon = item.Icon;
                  const selected = icon === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`create-workspace-icon-${item.id}`}
                      onClick={() => setIcon(item.id)}
                      aria-pressed={selected}
                      title={item.label}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                        selected
                          ? "bg-accent text-accent-content"
                          : "bg-base-200 text-base-content/65 hover:bg-base-300"
                      }`}
                    >
                      <Icon size={15} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-[20rem_minmax(0,1fr)]">
          <section className="flex min-w-0 flex-col gap-1.5">
            <span className={CAPTION}>{t("workspace.sources")}</span>

            <StorageCard
              icon={DataBase}
              title={t("workspace.source_browser_label")}
              subtitle={t("workspace.storage_browser_private")}
              status={
                <>
                  <span>{includedStatus}</span>
                  {storageUsage && <span>{storageUsage}</span>}
                </>
              }
            />

            <StorageCard
              icon={Cube}
              title={t("workspace.kind_arcana-filesystem")}
              status={<span>{includedStatus}</span>}
            />

            <StorageCard
              icon={Folder}
              title={t("workspace.source_browser.device")}
              subtitle={t("workspace.source_browser.folders", {
                count: localCount,
              })}
            >
              <button
                type="button"
                data-testid="create-workspace-source-local"
                onClick={pickLocalFolder}
                className={`${RAIL_ACTION} border-dashed`}
              >
                <Add size={14} className="shrink-0 text-base-content/50" />
                <span className="truncate">
                  {t("workspace.source_browser.add_device_folder")}
                </span>
              </button>
            </StorageCard>

            <StorageCard
              icon={GitRepo}
              title={t("workspace.repositories")}
              subtitle={t("workspace.repositories_count", { count: gitCount })}
            >
              {gitOpen ? (
                <div className="flex flex-col gap-2">
                  <input
                    data-testid="create-workspace-git-url"
                    aria-label={t("workspace.clone_repo_url")}
                    value={gitUrl}
                    onChange={(event) => setGitUrl(event.target.value)}
                    placeholder="https://github.com/user/repo.git"
                    className="input input-bordered input-sm w-full"
                    autoFocus
                  />
                  <input
                    aria-label={t("workspace.clone_branch")}
                    value={gitBranch}
                    onChange={(event) => setGitBranch(event.target.value)}
                    placeholder={t("workspace.clone_branch")}
                    className="input input-bordered input-sm w-full"
                  />
                  <select
                    aria-label={t("workspace.clone_agent")}
                    value={gitAgentId}
                    onChange={(event) => setGitAgentId(event.target.value)}
                    disabled={!localAgents.length}
                    className="select select-bordered select-sm w-full"
                  >
                    {localAgents.length === 0 ? (
                      <option value="">—</option>
                    ) : (
                      localAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name || agent.id}
                        </option>
                      ))
                    )}
                  </select>
                  {localAgents.length === 0 && (
                    <p className="text-[11px] text-warning">
                      {t("workspace.clone_no_agent")}
                    </p>
                  )}
                  {gitError && <p className="text-[11px] text-error">{gitError}</p>}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setGitOpen(false);
                        setGitError("");
                      }}
                    >
                      ← {t("common.back")}
                    </button>
                    <button
                      type="button"
                      data-testid="create-workspace-git-add"
                      className="btn btn-accent btn-sm"
                      onClick={addGitRow}
                      disabled={!localAgents.length}
                    >
                      {t("workspace.create_add")}
                    </button>
                  </div>
                </div>
              ) : (
                isFeatureEnabled("import_git") && (
                  <button
                    type="button"
                    data-testid="create-workspace-source-git"
                    onClick={() => {
                      setGitOpen(true);
                      setRailError("");
                    }}
                    className={RAIL_ACTION}
                  >
                    <GitRepo size={14} className="shrink-0 text-base-content/50" />
                    <span className="truncate">
                      {t("workspace.clone_repository")}
                    </span>
                    <Add size={12} className="ml-auto shrink-0 text-base-content/40" />
                  </button>
                )
              )}
            </StorageCard>

            <StorageCard
              icon={Server}
              title={t("workspace.storage_mcp_servers")}
              subtitle={t("workspace.source_browser.servers", {
                count: mcpCount,
              })}
            >
              {mcpOpen ? (
                <div className="flex flex-col gap-2">
                  <input
                    data-testid="create-workspace-mcp-endpoint"
                    aria-label={t("workspace.mcp_endpoint")}
                    value={mcpEndpoint}
                    onChange={(event) => setMcpEndpoint(event.target.value)}
                    placeholder="http://localhost:9000/mcp"
                    className="input input-bordered input-sm w-full"
                    autoFocus
                  />
                  <select
                    data-testid="create-workspace-mcp-transport"
                    aria-label={t("workspace.mcp_transport")}
                    value={mcpTransport}
                    onChange={(event) => setMcpTransport(event.target.value)}
                    className="select select-bordered select-sm w-full"
                  >
                    <option value="streamable-http">
                      {t("workspace.mcp_transport_streamable_http")}
                    </option>
                    <option value="sse">{t("workspace.mcp_transport_sse")}</option>
                  </select>
                  {mcpError && <p className="text-[11px] text-error">{mcpError}</p>}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setMcpOpen(false);
                        setMcpError("");
                      }}
                    >
                      ← {t("common.back")}
                    </button>
                    <button
                      type="button"
                      data-testid="create-workspace-mcp-add"
                      className="btn btn-accent btn-sm"
                      onClick={addMcpRow}
                    >
                      {t("workspace.create_add")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="create-workspace-source-mcp"
                  onClick={() => {
                    setMcpOpen(true);
                    setRailError("");
                  }}
                  className={RAIL_ACTION}
                >
                  <Server size={14} className="shrink-0 text-base-content/50" />
                  <span className="truncate">{t("workspace.connect_mcp")}</span>
                  <Add size={12} className="ml-auto shrink-0 text-base-content/40" />
                </button>
              )}
            </StorageCard>

            {railError && <p className="px-1 text-[11px] text-error">{railError}</p>}
            <p className="px-1 text-[11px] leading-relaxed text-base-content/45">
              {t("workspace.create_sources_hint")}
            </p>
          </section>

          <section className="flex flex-col gap-0.5 rounded-lg border border-base-300/70 bg-base-200/20 p-2 md:min-h-[13rem]">
            <span className={CAPTION}>
              {t("workspace.create_tree_title")}
            </span>
            {included.map(({ Icon, label }) => (
              <div key={label} className="flex min-w-0 items-center gap-2 px-1 py-1">
                <Icon size={14} className="shrink-0 text-base-content/45" />
                <span className="truncate text-xs text-base-content/70">{label}</span>
                <span className="ml-auto shrink-0 text-[11px] text-base-content/45">
                  {t("workspace.sources_included")}
                </span>
              </div>
            ))}
            {rows.length > 0 && <div className="my-1 border-t border-base-300/70" />}
            {rows.map((row) => (
              <div
                key={row.id}
                data-testid="create-workspace-tree-row"
                className="flex min-w-0 flex-col gap-0.5 px-1 py-1"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {row.kind === "mcp" ? (
                    <Server size={14} className="shrink-0 text-base-content/50" />
                  ) : row.kind === "git" ? (
                    <GitRepo size={14} className="shrink-0 text-base-content/50" />
                  ) : (
                    <Folder size={14} className="shrink-0 text-base-content/50" />
                  )}
                  <span className="truncate text-xs">{row.name}</span>
                  {row.path && (
                    <span className="shrink-0 text-[11px] text-base-content/45">
                      {row.path}
                    </span>
                  )}
                  {row.status === "working" && (
                    <span className="loading loading-spinner loading-xs" />
                  )}
                  {!busy && (
                    <button
                      type="button"
                      aria-label={t("workspace.clone_row_remove")}
                      onClick={() => removeRow(row.id)}
                      className="ml-auto shrink-0 rounded p-0.5 text-base-content/40 hover:text-error"
                    >
                      <Close size={12} />
                    </button>
                  )}
                </div>
                {row.status === "failed" && row.message && (
                  <p className="text-[11px] text-error">
                    {t("workspace.row_failed", { message: row.message })}
                  </p>
                )}
                {row.status !== "failed" && row.progress && (
                  <p className="text-[11px] text-base-content/50">{row.progress}</p>
                )}
              </div>
            ))}
            {rows.length === 0 && (
              <p className="px-1 py-2 text-[11px] text-base-content/45">
                {t("workspace.create_empty_hint")}
              </p>
            )}
          </section>
        </div>

        <div className="mt-1 flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-xs text-error">{error}</p>}
          <button type="button" className="btn" onClick={close} disabled={busy}>
            {t("common.cancel")}
          </button>
          {failed && workspaceId ? (
            <button type="button" className="btn btn-accent" onClick={openWorkspace}>
              {t("workspace.open_workspace")}
            </button>
          ) : (
            <button
              type="button"
              data-testid="create-workspace-create"
              className="btn btn-accent"
              onClick={create}
              disabled={!name.trim() || busy}
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
