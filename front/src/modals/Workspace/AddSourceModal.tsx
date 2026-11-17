import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import BaseModal from "../BaseModal";
import { addSource } from "../../db/workspaceDb";
import { newId } from "../../db";
import { hasLocalMcpServerValue } from "../../agent/mcp";
import { useAgents } from "../../agents/agentStore";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";
import { defaultCapabilities } from "../../workspace/capabilities";
import { DEVICE_PLANE_KINDS } from "../../workspace/deviceId";
import { cloneIntoWorkspace } from "../../workspace/cloneIntoWorkspace";
import type { CloneIntoWorkspaceProgress } from "../../workspace/cloneIntoWorkspace";
import { folderName } from "../../workspace/folders";
import { parsePublicGitUrl } from "../../workspace/importProject";
import { addLocalSource, pickDirectory } from "../../workspace/localWorkspace";
import { baseName } from "../../workspace/paths";
import { formatBytes } from "../../utils/formatBytes";

type AddSourceKind = "local" | "git" | "mcp";

const KINDS: AddSourceKind[] = ["local", "git", "mcp"];

const repoNameFromUrl = (value: string) => {
  try {
    const url = new URL(value);
    return baseName(url.pathname.replace(/\.git$/i, "")) || "repository";
  } catch {
    return "repository";
  }
};

export default function AddSourceModal({
  isOpen,
  onClose,
  workspaceId,
  onAdded,
  initialKind,
}) {
  const { t } = useTranslation();
  const userSettings = useSelector(selectUserSettings);
  const agents = useAgents();
  const [kind, setKind] = useState<AddSourceKind>(initialKind ?? "local");
  const [label, setLabel] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("");
  const [gitFolder, setGitFolder] = useState("");
  const [gitFolderEdited, setGitFolderEdited] = useState(false);
  const [cloneAgentId, setCloneAgentId] = useState("");
  const [progress, setProgress] = useState("");
  const [mcpEndpoint, setMcpEndpoint] = useState("");
  const [mcpTransport, setMcpTransport] = useState<"streamable-http" | "sse">(
    "streamable-http",
  );
  const [mcpAllowlist, setMcpAllowlist] = useState("");

  const localMcpEnabled =
    userSettings?.tools?.mcp === true &&
    hasLocalMcpServerValue(userSettings?.mcp_servers);

  const availableKinds = useMemo(
    () => KINDS.filter((item) => item !== "mcp" || localMcpEnabled),
    [localMcpEnabled],
  );

  const localAgents = useMemo(
    () =>
      agents.filter(
        (agent: any) => agent.local !== false && agent.sessionId,
      ),
    [agents],
  );
  const cloneAgent = localAgents.find((agent: any) => agent.id === cloneAgentId);

  const suggestedFolder = useMemo(() => {
    if (!gitUrl.trim()) return "";
    try {
      return repoNameFromUrl(parsePublicGitUrl(gitUrl));
    } catch {
      return "";
    }
  }, [gitUrl]);

  useEffect(() => {
    if (!availableKinds.includes(kind)) setKind(availableKinds[0] ?? "local");
  }, [availableKinds, kind]);

  useEffect(() => {
    if (!cloneAgentId && localAgents[0]?.id) {
      setCloneAgentId(localAgents[0].id);
    }
    if (
      cloneAgentId &&
      !localAgents.some((agent: any) => agent.id === cloneAgentId)
    ) {
      setCloneAgentId(localAgents[0]?.id ?? "");
    }
  }, [cloneAgentId, localAgents]);

  useEffect(() => {
    if (!gitFolderEdited) setGitFolder(suggestedFolder);
  }, [gitFolderEdited, suggestedFolder]);

  // Chrome only exposes showDirectoryPicker() on a secure page, and a blocked picker used to look
  // like a dead click. Say why up front instead of failing after the button is pressed.
  const localBlocker =
    window.isSecureContext === false
      ? t("workspace.local_insecure")
      : !("showDirectoryPicker" in window)
        ? t("workspace.local_unsupported")
        : "";

  /** OK is the only action that creates the source, so it stays off until the form can succeed. */
  const canSubmit =
    kind === "local"
      ? !!handle && !localBlocker
      : kind === "mcp"
        ? !!mcpEndpoint.trim()
        : !!gitUrl.trim() && !!cloneAgent;

  const reset = () => {
    setKind(initialKind ?? "local");
    setLabel("");
    setReadOnly(false);
    setHandle(null);
    setError("");
    setBusy(false);
    setGitUrl("");
    setGitBranch("");
    setGitFolder("");
    setGitFolderEdited(false);
    setCloneAgentId("");
    setProgress("");
    setMcpEndpoint("");
    setMcpTransport("streamable-http");
    setMcpAllowlist("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const finish = async (payload: {
    kind: SourceKind;
    label: string;
    config: any;
    handle?: FileSystemDirectoryHandle;
    status?: string;
  }) => {
    let id: string;
    if (payload.kind === "local" && payload.handle) {
      id = await addLocalSource({
        workspaceId,
        handle: payload.handle,
        label: payload.label,
        readOnly,
      });
    } else {
      id = newId();
      await addSource({
        id,
        workspaceId,
        kind: payload.kind,
        label: payload.label,
        config: payload.config,
        status: payload.status as any,
        capabilities: defaultCapabilities(payload.kind),
        readOnly,
        handle: payload.handle,
      });
    }
    onAdded?.(id);
    close();
  };

  /**
   * Picks the folder on its own, so the dialog can show what was chosen before the source is
   * created and OK can simply confirm it. `showDirectoryPicker` needs a user gesture, which the
   * button supplies.
   */
  const chooseFolder = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const picked = await pickDirectory({
        mode: readOnly ? "read" : "readwrite",
        insecureMessage: t("workspace.local_insecure"),
        unsupportedMessage: t("workspace.local_unsupported"),
        onPickerError: (event) => {
          // Chrome reports AbortError both for "user cancelled" and for "the file dialog could not
          // open / the folder was refused". Swallowing it made a blocked picker look like a click
          // that does nothing, so keep the failure visible and diagnosable.
          console.warn(
            "[workspace] directory picker did not return a folder",
            (event as Error)?.name,
            (event as Error)?.message,
          );
        },
      });
      setHandle(picked);
    } catch (event) {
      if ((event as Error)?.name === "AbortError") {
        setError(t("workspace.local_aborted"));
        return;
      }
      setError(event instanceof Error ? event.message : String(event));
    } finally {
      setBusy(false);
    }
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
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (kind === "local") {
        if (!handle) throw new Error(t("workspace.choose_folder_required"));
        await finish({
          kind,
          label: label.trim() || handle.name,
          config: { handleKey: "" },
          handle,
          status: "offline",
        });
        return;
      }
      if (kind === "mcp") {
        if (!mcpEndpoint.trim()) throw new Error(t("workspace.mcp_required"));
        await finish({
          kind,
          label: label.trim() || "MCP",
          config: {
            endpoint: mcpEndpoint.trim(),
            transport: mcpTransport,
            toolAllowlist: mcpAllowlist
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean),
          },
          status: "offline",
        });
        return;
      }
      if (kind === "git") {
        if (!cloneAgent) throw new Error(t("workspace.clone_agent_required"));
        const targetUrl = parsePublicGitUrl(gitUrl);
        const targetFolder = folderName(gitFolder.trim() || suggestedFolder, {
          maxLength: 120,
          rejectEmpty: true,
        });
        const result = await cloneIntoWorkspace({
          workspaceId,
          agent: cloneAgent,
          url: targetUrl,
          branch: gitBranch.trim() || undefined,
          folder: targetFolder,
          target: "browser",
          onProgress: (event: CloneIntoWorkspaceProgress) =>
            setProgress(progressText(event)),
        });
        onAdded?.(result);
        close();
      }
    } catch (event) {
      const name = (event as Error)?.name;
      if (name === "AbortError") {
        setBusy(false);
        return;
      }
      setError(event instanceof Error ? event.message : String(event));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={close}
      titleKey="workspace.add_source"
      isForced={busy && kind === "git"}
    >
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-base-content/70">
            {t("workspace.source_kind")}
          </span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as AddSourceKind)}
            aria-label={t("workspace.source_kind")}
            className="select select-bordered w-full"
          >
            {availableKinds.map((item) => (
              <option key={item} value={item}>
                {t(`workspace.kind_${item}`)}
              </option>
            ))}
          </select>
        </div>

        {kind === "local" && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.source_folder")}
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={chooseFolder}
                  disabled={busy || !!localBlocker}
                  className="btn btn-sm shrink-0"
                >
                  {t("workspace.choose_folder")}
                </button>
                <span
                  data-testid="local-source-folder"
                  className={`truncate text-xs ${
                    handle ? "text-base-content" : "text-base-content/50"
                  }`}
                  title={handle?.name}
                >
                  {handle ? handle.name : t("workspace.no_folder_chosen")}
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-base-content/60">
              {t("workspace.local_hint")}
            </p>
            {localBlocker && (
              <p className="text-xs leading-relaxed text-error">{localBlocker}</p>
            )}
          </>
        )}

        {kind === "git" && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.clone_repo_url")}
              </span>
              <input
                value={gitUrl}
                onChange={(event) => setGitUrl(event.target.value)}
                placeholder="https://example.org/team/repo.git"
                aria-label={t("workspace.clone_repo_url")}
                className="input input-bordered w-full"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-base-content/70">
                  {t("workspace.clone_branch")}
                </span>
                <input
                  value={gitBranch}
                  onChange={(event) => setGitBranch(event.target.value)}
                  aria-label={t("workspace.clone_branch")}
                  className="input input-bordered w-full"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-base-content/70">
                  {t("workspace.clone_folder")}
                </span>
                <input
                  value={gitFolder}
                  onChange={(event) => {
                    setGitFolder(event.target.value);
                    setGitFolderEdited(true);
                  }}
                  placeholder={suggestedFolder || t("workspace.clone_folder")}
                  aria-label={t("workspace.clone_folder")}
                  className="input input-bordered w-full"
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
                disabled={localAgents.length === 0}
                aria-label={t("workspace.clone_agent")}
                className="select select-bordered w-full"
              >
                {localAgents.length === 0 ? (
                  <option value="">—</option>
                ) : (
                  localAgents.map((agent: any) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name || agent.id}
                    </option>
                  ))
                )}
              </select>
            </label>
            {localAgents.length === 0 && (
              <p className="text-xs text-warning">
                {t("workspace.clone_no_agent")}
              </p>
            )}
          </>
        )}

        {kind !== "git" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-base-content/70">
              {t("workspace.source_label")}
            </span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t(`workspace.kind_${kind}`)}
              className="input input-bordered w-full"
            />
          </label>
        )}

        {kind === "mcp" && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.mcp_endpoint")}
              </span>
              <input
                value={mcpEndpoint}
                onChange={(event) => setMcpEndpoint(event.target.value)}
                placeholder="http://localhost:9000/mcp"
                className="input input-bordered w-full"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.mcp_transport")}
              </span>
              <select
                value={mcpTransport}
                onChange={(event) =>
                  setMcpTransport(event.target.value as "streamable-http" | "sse")
                }
                className="select select-bordered w-full"
              >
                <option value="streamable-http">Streamable HTTP</option>
                <option value="sse">SSE</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-base-content/70">
                {t("workspace.mcp_allowlist")}
              </span>
              <input
                value={mcpAllowlist}
                onChange={(event) => setMcpAllowlist(event.target.value)}
                placeholder="list_directory, read_file, write_file"
                className="input input-bordered w-full"
              />
            </label>
            <p className="text-xs leading-relaxed text-base-content/60">
              {t("workspace.mcp_hint")}
            </p>
          </>
        )}

        {DEVICE_PLANE_KINDS.has(kind) && (
          <p className="text-xs text-warning">{t("workspace.device_only_hint")}</p>
        )}
        {kind !== "git" && (
          <label className="flex items-center gap-2 text-xs text-base-content/70">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(event) => setReadOnly(event.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span>
              {t("workspace.source_read_only")}
              <span className="ml-1 text-base-content/45">
                {t("workspace.source_read_only_hint")}
              </span>
            </span>
          </label>
        )}

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className="btn"
            onClick={close}
            disabled={busy && kind === "git"}
          >
            {t("common.cancel")}
          </button>
          {kind === "git" && busy ? (
            <p className="text-xs text-base-content/60" role="status">
              {progress || t("workspace.clone_progress_clone")}
            </p>
          ) : (
            <button
              type="button"
              className="btn btn-accent"
              onClick={submit}
              disabled={busy || !canSubmit}
            >
              {t("common.ok")}
            </button>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
