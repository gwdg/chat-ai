import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";

import Tooltip from "../Others/Tooltip";

import { selectGlobalMcpServers } from "../../Redux/reducers/userSettingsReducer";

export default function McpServerPicker({ localState, setLocalState, kind = "all" }) {
  const { t } = useTranslation();
  const allServers = useSelector(selectGlobalMcpServers) ?? [];
  const servers = (allServers ?? []).filter(
    (server) => kind === "all" || server.kind === kind,
  );
  const localSelected = new Set(
    Array.isArray(localState?.settings?.mcp_local_server_ids)
      ? localState.settings.mcp_local_server_ids
      : [],
  );
  const remoteSelected = new Set(
    Array.isArray(localState?.settings?.mcp_remote_server_ids)
      ? localState.settings.mcp_remote_server_ids
      : [],
  );

  const toggle = (server) => {
    const local = server.kind === "local";
    const key = local ? "mcp_local_server_ids" : "mcp_remote_server_ids";
    const toolKey = local ? "mcp" : "mcp_remote";
    setLocalState((prev) => {
      const current = new Set(
        Array.isArray(prev.settings?.[key]) ? prev.settings[key] : [],
      );
      if (current.has(server.id)) current.delete(server.id);
      else current.add(server.id);
      return {
        ...prev,
        settings: {
          ...prev.settings,
          [key]: [...current],
          tools: {
            ...prev.settings?.tools,
            ...(current.size ? { [toolKey]: true } : {}),
          },
        },
        flush: true,
      };
    });
  };

  return (
    <div className="w-full space-y-2" data-guide="mcp-server-picker">
      <p className="flex items-center gap-1.5 text-sm text-base-content">
        <Tooltip text={t("mcp.tooltip")}>
          <span>{t("mcp.configured")}</span>
        </Tooltip>
        {servers.length > 0 && (
          <TriangleAlert
            className="h-3.5 w-3.5 shrink-0 text-warning"
            aria-hidden="true"
          />
        )}
      </p>
      {servers.length === 0 ? (
        <p className="text-xs text-base-content/60">
          {t("mcp.none_configured")}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {servers.map((server) => {
            const selected =
              server.kind === "local"
                ? localSelected.has(server.id)
                : remoteSelected.has(server.id);
            return (
              <label
                key={server.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-base-200"
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggle(server)}
                  className="checkbox checkbox-sm"
                />
                <span className="min-w-0 flex-1 truncate">
                  {server.name ||
                    (server.kind === "local" ? server.url : server.serverId)}
                </span>
                <span
                  className={`badge badge-xs ${
                    server.kind === "local" ? "badge-ghost" : "badge-warning"
                  }`}
                >
                  {t(
                    server.kind === "local"
                      ? "mcp.kind_local_short"
                      : "mcp.kind_remote_short",
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
