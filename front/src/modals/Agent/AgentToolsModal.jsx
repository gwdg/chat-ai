import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { TriangleAlert } from "lucide-react";

import BaseModal from "../BaseModal";
import { useToast } from "../../hooks/useToast";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";
import {
  addOpencodeMcpServer,
  clearOpencodeRevert,
  commitOpencodeRevert,
  connectOpencodeMcpServer,
  deleteSavedOpencodePermission,
  getOpencodeDiff,
  getOpencodeFileStatus,
  getOpencodeHealth,
  getOpencodeInfo,
  getOpencodePath,
  getOpencodeSession,
  getOpencodeVcs,
  listOpencodeMcpServers,
  listOpencodeMessages,
  listSavedOpencodePermissions,
  removeOpencodeMcpServer,
  stageOpencodeRevert,
} from "../../apis/opencodeAgents";
import {
  buildAgentHistoryJson,
  buildAgentHistoryMarkdown,
  downloadAgentHistory,
} from "../../agents/agentHistoryExport";
import {
  loadAgentPermissionPolicies,
  saveAgentPermissionPolicies,
} from "../../agents/agentPermissionPolicies";
import { loadAgentFormHistory } from "../../agents/agentFormHistory";
import { loadAgentShellHistory } from "../../agents/agentShellHistory";

const TABS = [
  "changes",
  "permissions",
  "policies",
  "stats",
  "mcp",
  "connection",
];

const ReadJson = ({ value }) => (
  <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-base-200 p-2 font-mono text-[11px]">
    {JSON.stringify(value, null, 2)}
  </pre>
);

export default function AgentToolsModal({ isOpen, onClose, agent }) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const userSettings = useSelector(selectUserSettings);
  const [tab, setTab] = useState("changes");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [diff, setDiff] = useState([]);
  const [messages, setMessages] = useState([]);
  const [revertMessageId, setRevertMessageId] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [policyAction, setPolicyAction] = useState("");
  const [policyDecision, setPolicyDecision] = useState("once");
  const [stats, setStats] = useState(null);
  const [mcpServers, setMcpServers] = useState([]);
  const [connection, setConnection] = useState(null);
  const [vcs, setVcs] = useState(null);
  const [trackedFiles, setTrackedFiles] = useState([]);

  const addedMcpNames = useMemo(
    () => new Set(mcpServers.map((server) => server.name)),
    [mcpServers],
  );

  const localMcpServers = useMemo(
    () =>
      (Array.isArray(userSettings?.mcp_servers)
        ? userSettings.mcp_servers
        : []
      ).filter(
        (server) =>
          server?.kind === "local" &&
          typeof server.url === "string" &&
          server.url.trim(),
      ),
    [userSettings],
  );

  const run = async (action, successKey) => {
    if (!agent?.sessionId || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (successKey) notifySuccess(t(successKey));
      return result;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      notifyError(message);
    } finally {
      setBusy(false);
    }
  };

  const storePolicies = (next) => {
    setPolicies(next);
    saveAgentPermissionPolicies(agent.id, next);
    window.dispatchEvent(
      new CustomEvent("chatai:agent-policies-updated", {
        detail: { agentId: agent.id },
      }),
    );
  };

  const addPolicy = () => {
    const action = policyAction.trim();
    if (!action || !agent?.id) return;
    storePolicies([
      ...policies.filter((policy) => policy.action !== action),
      {
        id: `${action}:${policyDecision}:${Date.now()}`,
        action,
        decision: policyDecision,
      },
    ]);
    setPolicyAction("");
  };

  const removePolicy = (id) => {
    storePolicies(policies.filter((policy) => policy.id !== id));
  };

  const exportHistory = async (format) => {
    if (!agent?.sessionId || busy) return;
    setBusy(true);
    setError("");
    try {
      const nextMessages = await listOpencodeMessages(
        agent,
        agent.sessionId,
      ).catch(() => []);
      const shells = loadAgentShellHistory(agent.id, agent.sessionId);
      const forms = loadAgentFormHistory(agent.id, agent.sessionId);
      const serialize =
        format === "json"
          ? buildAgentHistoryJson
          : buildAgentHistoryMarkdown;
      const content = serialize({
        agent,
        messages: nextMessages,
        shells,
        forms,
      });
      const safeName = String(agent.name || "agent")
        .replace(/[^\w.-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      downloadAgentHistory(
        `${safeName || "agent"}-${agent.sessionId}.${format === "json" ? "json" : "md"}`,
        content,
        format === "json" ? "application/json" : "text/markdown",
      );
      notifySuccess(t("agents.tools.exported"));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      notifyError(message);
    } finally {
      setBusy(false);
    }
  };

  const loadDiagnostics = async () => {
    const settled = await Promise.allSettled([
      getOpencodeInfo(agent),
      getOpencodeHealth(agent),
      getOpencodePath(agent),
      getOpencodeVcs(agent),
      getOpencodeSession(agent, agent.sessionId),
    ]);
    const value = (index) =>
      settled[index].status === "fulfilled" ? settled[index].value : null;
    const errors = settled
      .filter((item) => item.status === "rejected")
      .map((item) =>
        item.reason instanceof Error ? item.reason.message : String(item.reason),
      );
    setConnection({
      info: value(0),
      health: value(1),
      path: value(2),
      vcs: value(3),
      session: value(4),
      errors,
    });
    setVcs(value(3));
  };

  useEffect(() => {
    if (!isOpen || !agent?.sessionId) return;
    let cancelled = false;
    setError("");
    void (async () => {
      try {
        if (tab === "changes") {
          const [nextDiff, nextMessages, nextVcs, nextFiles] =
            await Promise.all([
              getOpencodeDiff(agent, agent.sessionId),
              listOpencodeMessages(agent, agent.sessionId),
              getOpencodeVcs(agent).catch(() => null),
              getOpencodeFileStatus(agent).catch(() => []),
            ]);
          if (cancelled) return;
          setDiff(nextDiff);
          setVcs(nextVcs);
          setTrackedFiles(Array.isArray(nextFiles) ? nextFiles : []);
          const users = nextMessages.filter((message) => message.type === "user");
          setMessages(users);
          setRevertMessageId((current) => current || users.at(-1)?.id || "");
        } else if (tab === "permissions") {
          const info = await getOpencodeSession(agent, agent.sessionId);
          const next = await listSavedOpencodePermissions(agent, info?.projectID);
          if (!cancelled) setPermissions(next);
        } else if (tab === "policies") {
          if (!cancelled) setPolicies(loadAgentPermissionPolicies(agent.id));
        } else if (tab === "connection") {
          await loadDiagnostics();
        } else if (tab === "stats") {
          const info = await getOpencodeSession(agent, agent.sessionId);
          if (!cancelled) setStats(info);
        } else if (tab === "mcp") {
          const next = await listOpencodeMcpServers(agent);
          if (!cancelled) setMcpServers(next);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, agent, tab]);

  const syncMcp = async (server) => {
    const name = server.name || server.id;
    if (!name || !server.url) return;
    const ok = await run(async () => {
      await addOpencodeMcpServer(agent, name, {
        type: "remote",
        url: server.url,
        headers: server.headers,
      });
      await connectOpencodeMcpServer(agent, name);
      setMcpServers(await listOpencodeMcpServers(agent));
    }, "agents.tools.mcp_synced");
    return ok;
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="agents.tools.title"
      maxWidth="max-w-3xl"
    >
      <div className="flex max-h-[70vh] min-h-0 flex-col gap-3 pb-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`btn btn-xs ${tab === item ? "btn-accent" : "btn-ghost"}`}
            >
              {t(`agents.tools.tabs.${item}`)}
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              disabled={busy}
              onClick={() => void exportHistory("md")}
            >
              {t("agents.tools.export_md")}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              disabled={busy}
              onClick={() => void exportHistory("json")}
            >
              {t("agents.tools.export_json")}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "changes" && (
            <div className="space-y-3">
              {vcs && (
                <div className="rounded-lg border border-base-300 p-2 text-xs">
                  <p className="font-medium">{t("agents.tools.workspace")}</p>
                  <ReadJson value={vcs} />
                </div>
              )}
              {trackedFiles.length > 0 && (
                <div className="rounded-lg border border-base-300 p-2 text-xs">
                  <p className="mb-1 font-medium">
                    {t("agents.tools.tracked_files")}
                  </p>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {trackedFiles.map((file, index) => (
                      <div
                        key={file.path ?? file.file ?? index}
                        className="flex gap-2"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono">
                          {file.path ?? file.file}
                        </span>
                        <span className="text-base-content/60">
                          {file.status ?? file.code ?? ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={revertMessageId}
                  onChange={(event) => setRevertMessageId(event.target.value)}
                  className="select select-bordered select-sm min-w-0 flex-1"
                >
                  <option value="" disabled>
                    {t("agents.tools.no_messages")}
                  </option>
                  {messages.map((message) => (
                    <option key={message.id} value={message.id}>
                      {(message.text || message.id).slice(0, 80)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-warning btn-sm"
                  disabled={!revertMessageId || busy}
                  onClick={() =>
                    void run(async () => {
                      await stageOpencodeRevert(
                        agent,
                        agent.sessionId,
                        revertMessageId,
                        true,
                      );
                      await commitOpencodeRevert(agent, agent.sessionId);
                      setDiff(await getOpencodeDiff(agent, agent.sessionId));
                    }, "agents.tools.reverted")
                  }
                >
                  {t("agents.tools.revert")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await clearOpencodeRevert(agent, agent.sessionId);
                      notifySuccess(t("agents.tools.revert_cleared"));
                    })
                  }
                >
                  {t("agents.tools.clear_revert")}
                </button>
              </div>
              {diff.length === 0 ? (
                <p className="text-xs text-base-content/60">
                  {t("agents.tools.no_changes")}
                </p>
              ) : (
                diff.map((file) => (
                  <div key={file.file} className="rounded-xl border border-base-300">
                    <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium">{file.file}</span>
                      <span className="badge badge-success badge-xs">+{file.additions}</span>
                      <span className="badge badge-error badge-xs">-{file.deletions}</span>
                    </div>
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px]">
                      {file.patch}
                    </pre>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "permissions" && (
            <div className="space-y-2">
              {permissions.length === 0 ? (
                <p className="text-xs text-base-content/60">
                  {t("agents.tools.no_saved_permissions")}
                </p>
              ) : (
                permissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="flex items-center gap-2 rounded-lg border border-base-300 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {permission.action}: {permission.resource}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await deleteSavedOpencodePermission(agent, permission.id);
                          setPermissions((current) =>
                            current.filter((item) => item.id !== permission.id),
                          );
                        }, "agents.tools.permission_removed")
                      }
                    >
                      {t("agents.tools.remove")}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "policies" && (
            <div className="space-y-3 text-xs">
              <p className="flex items-start gap-1 leading-relaxed text-base-content/60">
                <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                <span>{t("agents.tools.policies_hint")}</span>
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
                  <span className="text-base-content/60">
                    {t("agents.tools.policy_action")}
                  </span>
                  <input
                    value={policyAction}
                    onChange={(event) => setPolicyAction(event.target.value)}
                    placeholder="bash, edit, *"
                    className="input input-bordered input-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-base-content/60">
                    {t("agents.tools.policy_decision")}
                  </span>
                  <select
                    value={policyDecision}
                    onChange={(event) => setPolicyDecision(event.target.value)}
                    className="select select-bordered select-sm"
                  >
                    <option value="once">{t("agents.tools.policy_once")}</option>
                    <option value="always">
                      {t("agents.tools.policy_always")}
                    </option>
                    <option value="reject">
                      {t("agents.tools.policy_reject")}
                    </option>
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  disabled={!policyAction.trim()}
                  onClick={addPolicy}
                >
                  {t("agents.tools.policy_add")}
                </button>
              </div>
              {policies.length === 0 ? (
                <p className="text-base-content/60">
                  {t("agents.tools.no_policies")}
                </p>
              ) : (
                policies.map((policy) => (
                  <div
                    key={policy.id}
                    className="flex items-center gap-2 rounded-lg border border-base-300 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono">
                      {policy.action}
                    </span>
                    <span className="badge badge-ghost badge-xs">
                      {t(`agents.tools.policy_${policy.decision}`)}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => removePolicy(policy.id)}
                    >
                      {t("agents.tools.remove")}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "stats" && (
            <div className="space-y-3 text-xs">
              {stats ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded bg-base-200 p-2">
                    <span className="text-base-content/60">Input</span>
                    <p className="font-mono">{stats.tokens?.input ?? 0}</p>
                  </div>
                  <div className="rounded bg-base-200 p-2">
                    <span className="text-base-content/60">Output</span>
                    <p className="font-mono">{stats.tokens?.output ?? 0}</p>
                  </div>
                  <div className="rounded bg-base-200 p-2">
                    <span className="text-base-content/60">Cost</span>
                    <p className="font-mono">{stats.cost ?? 0}</p>
                  </div>
                  <div className="rounded bg-base-200 p-2">
                    <span className="text-base-content/60">Outcome</span>
                    <p className="font-mono">{stats.outcome ?? "—"}</p>
                  </div>
                </div>
              ) : (
                <p className="text-base-content/60">{t("agents.tools.no_stats")}</p>
              )}
            </div>
          )}

          {tab === "mcp" && (
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-xs font-medium">
                    {t("agents.tools.opencode_mcp")}
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        setMcpServers(await listOpencodeMcpServers(agent));
                      })
                    }
                  >
                    {t("common.refresh")}
                  </button>
                </div>
                {mcpServers.length === 0 ? (
                  <p className="text-xs text-base-content/60">
                    {t("agents.tools.no_mcp")}
                  </p>
                ) : (
                  mcpServers.map((server) => (
                    <div
                      key={server.name}
                      className="mb-1 flex items-center gap-2 rounded-lg border border-base-300 px-3 py-2 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {server.title || server.name}
                      </span>
                      <span className="badge badge-ghost badge-xs">
                        {String(server.status?.type ?? server.status)}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await connectOpencodeMcpServer(agent, server.name);
                            setMcpServers(await listOpencodeMcpServers(agent));
                          }, "agents.tools.mcp_reconnected")
                        }
                      >
                        {t("agents.tools.reconnect")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await removeOpencodeMcpServer(agent, server.name);
                            setMcpServers(await listOpencodeMcpServers(agent));
                          }, "agents.tools.mcp_removed")
                        }
                      >
                        {t("agents.tools.remove")}
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium">
                  {t("agents.tools.chatai_mcp")}
                </p>
                <p className="mb-2 flex items-start gap-1 text-[11px] leading-relaxed text-base-content/60">
                  <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                  <span>{t("agents.tools.mcp_transfer_hint")}</span>
                </p>
                {localMcpServers.length === 0 ? (
                  <p className="text-xs text-base-content/60">
                    {t("agents.tools.no_chatai_mcp")}
                  </p>
                ) : (
                  localMcpServers.map((server) => {
                    const name = server.name || server.id;
                    const added = addedMcpNames.has(name);
                    return (
                      <div
                        key={server.id}
                        className="mb-1 flex items-center gap-2 rounded-lg border border-base-300 px-3 py-2 text-xs"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            {server.name || server.url}
                          </span>
                          <span className="block truncate text-[10px] text-base-content/50">
                            {server.url}
                          </span>
                        </span>
                        {added ? (
                          <span className="badge badge-success badge-xs">
                            {t("agents.tools.added")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-accent btn-xs"
                            disabled={busy}
                            onClick={() => void syncMcp(server)}
                          >
                            {t("agents.tools.add_to_opencode")}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {tab === "connection" && (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {agent.serverUrl}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  disabled={busy}
                  onClick={() => void run(loadDiagnostics)}
                >
                  {t("agents.tools.test_connection")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() =>
                    void navigator.clipboard
                      ?.writeText(
                        JSON.stringify(
                          { agent: agent.serverUrl, connection },
                          null,
                          2,
                        ),
                      )
                      .then(() => notifySuccess(t("agents.tools.copied")))
                      .catch(() => {})
                  }
                >
                  {t("agents.tools.copy_diagnostics")}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded bg-base-200 p-2">
                  <span className="text-base-content/60">Version</span>
                  <p className="font-mono">
                    {connection?.health?.version ??
                      connection?.info?.version ??
                      "—"}
                  </p>
                </div>
                <div className="rounded bg-base-200 p-2">
                  <span className="text-base-content/60">Session</span>
                  <p className="truncate font-mono">{agent.sessionId}</p>
                </div>
                <div className="rounded bg-base-200 p-2">
                  <span className="text-base-content/60">Path</span>
                  <p className="truncate font-mono">
                    {connection?.path?.directory ??
                      connection?.path?.cwd ??
                      "—"}
                  </p>
                </div>
                <div className="rounded bg-base-200 p-2">
                  <span className="text-base-content/60">VCS</span>
                  <p className="truncate font-mono">
                    {connection?.vcs?.branch ??
                      connection?.vcs?.head ??
                      "—"}
                  </p>
                </div>
              </div>
              {connection ? (
                <>
                  {connection.errors?.length > 0 && (
                    <div className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-warning">
                      {connection.errors.map((message, index) => (
                        <p key={index} className="break-words">
                          {message}
                        </p>
                      ))}
                    </div>
                  )}
                  <ReadJson value={connection} />
                </>
              ) : (
                <p className="text-base-content/60">
                  {t("agents.tools.no_diagnostics")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
