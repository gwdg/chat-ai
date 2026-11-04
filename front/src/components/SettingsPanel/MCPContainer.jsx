// components/settings/MCPContainer.jsx
// MCP servers of the conversation (settings.mcp_servers): a list of {url, enabled, headers?}.
// The agent connects to the enabled ones (agent/mcp.ts); without agent mode the first one goes
// to the gateway as before (apis/chatCompletions.jsx).
import { Trans, useTranslation } from "react-i18next";
import { CircleHelp, Plus, Trash2 } from "lucide-react";
import { useModal } from "../../modals/ModalContext";
import { mcpServers } from "../../agent/mcp";
import { isAgentEnabled } from "../../apis/agentEndpoints";

const inputClass =
  "dark:text-white text-black bg-white dark:bg-bg_secondary_dark px-3 border dark:border-border_dark outline-none rounded-lg shadow-lg dark:shadow-dark w-full h-[36px] text-sm";

const MCPContainer = ({ localState, setLocalState }) => {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const servers = mcpServers(localState.settings);

  const update = (next) =>
    setLocalState((prev) => ({ ...prev, settings: { ...prev.settings, mcp_servers: next }, flush: true }));
  const change = (index, patch) => update(servers.map((server, i) => (i === index ? { ...server, ...patch } : server)));
  const setAuth = (index, value) => {
    const { Authorization, ...rest } = servers[index].headers ?? {};
    const headers = value ? { ...rest, Authorization: value } : rest;
    change(index, { headers: Object.keys(headers).length ? headers : undefined });
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-2 select-none">
        <p className="text-sm">{t("settings.label_mcp_server")}</p>
        <CircleHelp
          className="h-4 w-4 cursor-pointer text-[#009EE0]"
          alt="help"
          onClick={() => openModal("helpMCP")}
        />
      </div>

      {servers.map((server, index) => (
        <div key={index} className="flex flex-wrap md:flex-nowrap items-center gap-2">
          <input
            type="checkbox"
            checked={!!server.enabled}
            onChange={() => change(index, { enabled: !server.enabled })}
            title={t("settings.mcp_toggle")}
            aria-label={t("settings.mcp_toggle")}
            className="h-4 w-4 accent-primary cursor-pointer shrink-0"
          />
          <input
            type="text"
            value={server.url}
            onChange={(e) => change(index, { url: e.target.value.trim() })}
            placeholder={t("settings.placeholder_mcp_url")}
            className={inputClass}
          />
          {isAgentEnabled() && (
            <input
              type="password"
              autoComplete="off"
              value={server.headers?.Authorization ?? ""}
              onChange={(e) => setAuth(index, e.target.value)}
              placeholder={t("settings.placeholder_mcp_auth")}
              className={`${inputClass} md:max-w-[16rem]`}
            />
          )}
          <button
            type="button"
            onClick={() => update(servers.filter((_, i) => i !== index))}
            title={t("settings.mcp_remove")}
            aria-label={t("settings.mcp_remove")}
            className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-red-600 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => update([...servers, { url: "", enabled: true }])}
        className="flex items-center gap-1.5 text-sm text-primary cursor-pointer select-none"
      >
        <Plus className="h-4 w-4" />
        {t("settings.mcp_add")}
      </button>

      {!isAgentEnabled() && servers.length > 1 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 select-none">{t("settings.mcp_gateway_first")}</div>
      )}
      {servers.some((server) => server.enabled && server.url) && (
        <div className="text-yellow-600 text-xs w-full select-none">
          <Trans i18nKey="alert.mcp_usage" />
        </div>
      )}
    </div>
  );
};

export default MCPContainer;
