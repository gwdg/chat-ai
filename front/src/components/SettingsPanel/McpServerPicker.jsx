import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";

import { selectGlobalMcpServers } from "../../Redux/reducers/userSettingsReducer";

export default function McpServerPicker({ localState, setLocalState, kind }) {
  const { t } = useTranslation();
  const allServers = useSelector(selectGlobalMcpServers) ?? [];
  const servers = (allServers ?? []).filter((server) => server.kind === kind);
  const key =
    kind === "local" ? "mcp_local_server_ids" : "mcp_remote_server_ids";
  const toolKey = kind === "local" ? "mcp" : "mcp_remote";
  const selected = new Set(
    Array.isArray(localState?.settings?.[key])
      ? localState.settings[key]
      : [],
  );

  const toggle = (id) => {
    setLocalState((prev) => {
      const current = new Set(
        Array.isArray(prev.settings?.[key]) ? prev.settings[key] : [],
      );
      if (current.has(id)) current.delete(id);
      else current.add(id);
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
    <div className="w-full space-y-2">
      <p className="text-sm">{t("mcp.configured")}</p>
      {servers.length === 0 ? (
        <p className="text-xs text-base-content/60">
          {t("mcp.none_configured")}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {servers.map((server) => (
            <label
              key={server.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-base-200"
            >
              <input
                type="checkbox"
                checked={selected.has(server.id)}
                onChange={() => toggle(server.id)}
                className="checkbox checkbox-sm"
              />
              <span className="min-w-0 flex-1 truncate">
                {server.name ||
                  (server.kind === "local" ? server.url : server.serverId)}
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-base-content/45">
                {t(
                  server.kind === "local"
                    ? "mcp.kind_local_short"
                    : "mcp.kind_remote_short",
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
