// components/settings/MCPContainer.jsx
// MCP configuration. GWDG Tools edits the remote gateway servers (entries with a server id)
// and Local tools edits the agent's direct servers (entries with a URL); both live in
// settings.mcp_servers. They are switched separately: tools.mcp_remote for the gateway and
// tools.mcp for the agent, which only picks up the URL entries (agent/mcp.ts).
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleHelp, FlaskConical, Loader2, Plus, Trash2 } from "lucide-react";
import { useModal } from "../../modals/ModalContext";
import { isRemoteMcpServer, mcpServers, testMcpServer } from "../../agent/mcp";
import { useToast } from "../../hooks/useToast";

const inputClass = "input input-sm w-full";

const MCPContainer = ({ localState, setLocalState, remote = false }) => {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { notifySuccess, notifyError } = useToast();
  const [testStatus, setTestStatus] = useState({});
  const testing = Object.values(testStatus).includes("testing");
  const raw = localState.settings?.mcp_servers;
  const servers = mcpServers(localState.settings);
  const remoteServers = Array.isArray(raw)
    ? raw.filter(isRemoteMcpServer)
    : typeof raw === "string" && raw.trim()
      ? [{ id: raw.trim(), enabled: true }]
      : [];

  const update = (next) =>
    setLocalState((prev) => ({ ...prev, settings: { ...prev.settings, mcp_servers: next }, flush: true }));

  const setRemoteServers = (nextRemote) => {
    const localEntries = Array.isArray(raw) ? raw.filter((server) => !isRemoteMcpServer(server)) : [];
    update([...localEntries, ...nextRemote]);
  };

  const setLocalServers = (nextLocal) => {
    if (Array.isArray(raw)) {
      update([...raw.filter(isRemoteMcpServer), ...nextLocal]);
    } else if (typeof raw === "string" && raw.trim()) {
      update([{ id: raw.trim(), enabled: true }, ...nextLocal]);
    } else {
      update(nextLocal);
    }
  };

  const resetTest = (index) =>
    setTestStatus((prev) => {
      if (!(index in prev)) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });

  const changeLocal = (index, patch) => {
    resetTest(index);
    setLocalServers(servers.map((server, i) => (i === index ? { ...server, ...patch } : server)));
  };
  const setAuth = (index, value) => {
    const { Authorization, ...rest } = servers[index].headers ?? {};
    const headers = value ? { ...rest, Authorization: value } : rest;
    changeLocal(index, { headers: Object.keys(headers).length ? headers : undefined });
  };
  const changeRemote = (index, patch) => {
    resetTest(index);
    setRemoteServers(
      remoteServers.map((server, i) => (i === index ? { ...server, ...patch } : server)),
    );
  };
  const setRemoteAuth = (index, value) => {
    const { Authorization, ...rest } = remoteServers[index].headers ?? {};
    const headers = value ? { ...rest, Authorization: value } : rest;
    changeRemote(index, { headers: Object.keys(headers).length ? headers : undefined });
  };

  // An enabled MCP section always has at least one row, and that first row cannot be removed.
  useEffect(() => {
    if (remote) {
      if (remoteServers.length === 0) setRemoteServers([{ id: "", enabled: true }]);
    } else if (servers.length === 0) {
      setLocalServers([{ url: "", enabled: true }]);
    }
  }, [remote, remoteServers.length, servers.length]);

  // A row that changed or moved may not keep another row's test result.
  useEffect(() => {
    setTestStatus({});
  }, [servers.length, remoteServers.length]);

  const testServer = async (index, server) => {
    if (testing) return;
    setTestStatus((prev) => ({ ...prev, [index]: "testing" }));
    try {
      const result = await testMcpServer(server);
      // The name is read-only in the row and remembered for the next connection.
      if (remote) changeRemote(index, { name: result.name });
      else changeLocal(index, { name: result.name });
      setTestStatus((prev) => ({ ...prev, [index]: "success" }));
      notifySuccess(
        t("settings.mcp_test_success", {
          name: result.name,
          count: result.toolCount,
        }),
      );
    } catch (error) {
      setTestStatus((prev) => ({ ...prev, [index]: "error" }));
      notifyError(
        t("settings.mcp_test_failed", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };

  const testButton = (index, disabled, server) => {
    const status = testStatus[index];
    const iconColor =
      status === "success" ? "text-success" : status === "error" ? "text-error" : "";
    return (
      <button
        type="button"
        onClick={() => testServer(index, server)}
        disabled={disabled || testing}
        title={t("settings.mcp_test")}
        aria-label={t("settings.mcp_test")}
        className="shrink-0 p-1.5 rounded-lg text-base-content/60 hover:text-accent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-base-content/60"
      >
        {status === "testing" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FlaskConical className={`h-4 w-4 ${iconColor}`} />
        )}
      </button>
    );
  };

  const header = (
    <div className="flex items-center gap-2 select-none">
      <p className="text-sm">{t("settings.label_mcp_server")}</p>
      <CircleHelp
        className="h-4 w-4 cursor-pointer text-accent"
        alt="help"
        onClick={() => openModal("helpMCP")}
      />
    </div>
  );

  if (remote) {
    return (
      <div className="w-full space-y-2">
        {header}

        {remoteServers.map((server, index) => (
          <div key={index} className="flex flex-wrap md:flex-nowrap items-center gap-2">
            <input
              type="checkbox"
              checked={server.enabled !== false}
              onChange={() => changeRemote(index, { enabled: server.enabled === false })}
              title={t("settings.mcp_toggle")}
              aria-label={t("settings.mcp_toggle")}
              className="checkbox checkbox-sm shrink-0"
            />
            {server.name && (
              <span
                className="w-[8rem] shrink-0 truncate text-[11px] text-base-content/70"
                title={server.name}
              >
                {server.name}
              </span>
            )}
            <input
              type="text"
              data-guide="mcp-input"
              value={server.id}
              onChange={(e) => changeRemote(index, { id: e.target.value.trim() })}
              placeholder={t("settings.placeholder_mcp_id")}
              className={`${inputClass} min-w-0 md:max-w-none md:flex-1`}
            />
            <input
              type="password"
              autoComplete="off"
              value={server.headers?.Authorization ?? ""}
              onChange={(e) => setRemoteAuth(index, e.target.value)}
              placeholder={t("settings.placeholder_mcp_auth")}
              className={`${inputClass} min-w-0 md:max-w-none md:flex-1`}
            />
            {testButton(index, !server.id.trim(), {
              url: server.id,
              headers: server.headers,
            })}
            <button
              type="button"
              onClick={() =>
                index > 0 && setRemoteServers(remoteServers.filter((_, i) => i !== index))
              }
              disabled={index === 0}
              title={t("settings.mcp_remove")}
              aria-label={t("settings.mcp_remove")}
              className="shrink-0 p-1.5 rounded-lg text-base-content/60 hover:text-error cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-base-content/60"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setRemoteServers([...remoteServers, { id: "", enabled: true }])
          }
          className="flex items-center gap-1.5 text-sm text-primary cursor-pointer select-none"
        >
          <Plus className="h-4 w-4" />
          {t("settings.mcp_add")}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {header}

      {servers.map((server, index) => (
        <div key={index} className="flex flex-wrap md:flex-nowrap items-center gap-2">
          <input
            type="checkbox"
            checked={server.enabled !== false}
            onChange={() => changeLocal(index, { enabled: server.enabled === false })}
            title={t("settings.mcp_toggle")}
            aria-label={t("settings.mcp_toggle")}
            className="checkbox checkbox-sm shrink-0"
          />
          {server.name && (
            <span
              className="w-[8rem] shrink-0 truncate text-[11px] text-base-content/70"
              title={server.name}
            >
              {server.name}
            </span>
          )}
          <input
            type="text"
            data-guide="mcp-input"
            value={server.url}
            onChange={(e) => changeLocal(index, { url: e.target.value.trim() })}
            placeholder={t("settings.placeholder_mcp_url")}
            className={`${inputClass} min-w-0 md:max-w-none md:flex-1`}
          />
          <input
            type="password"
            autoComplete="off"
            value={server.headers?.Authorization ?? ""}
            onChange={(e) => setAuth(index, e.target.value)}
            placeholder={t("settings.placeholder_mcp_auth")}
            className={`${inputClass} min-w-0 md:max-w-none md:flex-1`}
          />
          {testButton(index, !server.url.trim(), {
            url: server.url,
            headers: server.headers,
          })}
          <button
            type="button"
            onClick={() =>
              index > 0 && setLocalServers(servers.filter((_, i) => i !== index))
            }
            disabled={index === 0}
            title={t("settings.mcp_remove")}
            aria-label={t("settings.mcp_remove")}
            className="shrink-0 p-1.5 rounded-lg text-base-content/60 hover:text-error cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-base-content/60"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setLocalServers([...servers, { url: "", enabled: true }])}
        className="flex items-center gap-1.5 text-sm text-primary cursor-pointer select-none"
      >
        <Plus className="h-4 w-4" />
        {t("settings.mcp_add")}
      </button>
    </div>
  );
};

export default MCPContainer;
