// components/settings/MCPContainer.jsx
// MCP configuration. GWDG Tools edits the remote gateway servers (entries with a server id)
// and Local tools edits the agent's direct servers (entries with a URL); both live in
// settings.mcp_servers, and agent/mcp.ts only picks up the URL entries.
import { useTranslation } from "react-i18next";
import { CircleHelp, Plus, Trash2 } from "lucide-react";
import { useModal } from "../../modals/ModalContext";
import { mcpServers } from "../../agent/mcp";

const inputClass = "input input-sm w-full";

const isRemoteEntry = (server) =>
  !!server &&
  typeof server === "object" &&
  typeof server.id === "string" &&
  typeof server.url !== "string";

const MCPContainer = ({ localState, setLocalState, remote = false }) => {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const raw = localState.settings?.mcp_servers;
  const servers = mcpServers(localState.settings);
  const remoteServers = Array.isArray(raw)
    ? raw.filter(isRemoteEntry)
    : typeof raw === "string" && raw.trim()
      ? [{ id: raw.trim(), enabled: true }]
      : [];

  const update = (next) =>
    setLocalState((prev) => ({ ...prev, settings: { ...prev.settings, mcp_servers: next }, flush: true }));

  const setRemoteServers = (nextRemote) => {
    const localEntries = Array.isArray(raw) ? raw.filter((server) => !isRemoteEntry(server)) : [];
    update([...localEntries, ...nextRemote]);
  };

  const setLocalServers = (nextLocal) => {
    if (Array.isArray(raw)) {
      update([...raw.filter(isRemoteEntry), ...nextLocal]);
    } else if (typeof raw === "string" && raw.trim()) {
      update([{ id: raw.trim(), enabled: true }, ...nextLocal]);
    } else {
      update(nextLocal);
    }
  };

  const changeLocal = (index, patch) =>
    setLocalServers(servers.map((server, i) => (i === index ? { ...server, ...patch } : server)));
  const setAuth = (index, value) => {
    const { Authorization, ...rest } = servers[index].headers ?? {};
    const headers = value ? { ...rest, Authorization: value } : rest;
    changeLocal(index, { headers: Object.keys(headers).length ? headers : undefined });
  };
  const changeRemote = (index, patch) =>
    setRemoteServers(
      remoteServers.map((server, i) => (i === index ? { ...server, ...patch } : server)),
    );
  const setRemoteAuth = (index, value) => {
    const { Authorization, ...rest } = remoteServers[index].headers ?? {};
    const headers = value ? { ...rest, Authorization: value } : rest;
    changeRemote(index, { headers: Object.keys(headers).length ? headers : undefined });
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
            <input
              type="text"
              data-guide="mcp-input"
              value={server.id}
              onChange={(e) => changeRemote(index, { id: e.target.value.trim() })}
              placeholder={t("settings.placeholder_mcp_id")}
              className={inputClass}
            />
            <input
              type="password"
              autoComplete="off"
              value={server.headers?.Authorization ?? ""}
              onChange={(e) => setRemoteAuth(index, e.target.value)}
              placeholder={t("settings.placeholder_mcp_auth")}
              className={`${inputClass} md:max-w-[16rem]`}
            />
            <button
              type="button"
              onClick={() =>
                setRemoteServers(remoteServers.filter((_, i) => i !== index))
              }
              title={t("settings.mcp_remove")}
              aria-label={t("settings.mcp_remove")}
              className="shrink-0 p-1.5 rounded-lg text-base-content/60 hover:text-error cursor-pointer"
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
          <input
            type="text"
            data-guide="mcp-input"
            value={server.url}
            onChange={(e) => changeLocal(index, { url: e.target.value.trim() })}
            placeholder={t("settings.placeholder_mcp_url")}
            className={inputClass}
          />
          <input
            type="password"
            autoComplete="off"
            value={server.headers?.Authorization ?? ""}
            onChange={(e) => setAuth(index, e.target.value)}
            placeholder={t("settings.placeholder_mcp_auth")}
            className={`${inputClass} md:max-w-[16rem]`}
          />
          <button
            type="button"
            onClick={() => setLocalServers(servers.filter((_, i) => i !== index))}
            title={t("settings.mcp_remove")}
            aria-label={t("settings.mcp_remove")}
            className="shrink-0 p-1.5 rounded-lg text-base-content/60 hover:text-error cursor-pointer"
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
