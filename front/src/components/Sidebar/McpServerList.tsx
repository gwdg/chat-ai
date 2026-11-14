import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { ChevronDown, Plus, Server, Trash2 } from "lucide-react";

import { useModal } from "../../modals/ModalContext";
import {
  removeMcpServer,
  selectGlobalMcpServers,
} from "../../Redux/reducers/userSettingsReducer";
import {
  selectCollapsedTopics,
  toggleTopic,
} from "../../Redux/reducers/interfaceSettingsSlice";
import type { GlobalMcpServer } from "../../agent/mcp";

export default function McpServerList() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const servers = useSelector(selectGlobalMcpServers) as GlobalMcpServer[];
  const collapsedTopicIds = useSelector(selectCollapsedTopics) ?? [];
  const collapsed = collapsedTopicIds.includes("__mcp_servers__");

  const edit = (server?: GlobalMcpServer) =>
    openModal("mcpServerEdit", { server });

  return (
    <div className="px-3 pt-2 pb-1">
      <div className="mb-1 flex items-center gap-1 px-1">
        <button
          type="button"
          onClick={() => dispatch(toggleTopic("__mcp_servers__"))}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-md text-left text-[10px] font-semibold uppercase tracking-wider text-base-content/45 transition hover:text-base-content"
          aria-expanded={!collapsed}
        >
          <ChevronDown
            size={12}
            className={`shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <span className="truncate">{t("mcp.section_title")}</span>
        </button>
        <button
          type="button"
          onClick={() => edit()}
          data-guide="mcp-servers-add"
          className="flex h-6 w-6 items-center justify-center rounded-md text-base-content/50 transition hover:bg-base-200 hover:text-accent"
          title={t("mcp.add")}
          aria-label={t("mcp.add")}
        >
          <Plus size={15} />
        </button>
      </div>

      {collapsed ? null : servers.length === 0 ? (
        <button
          type="button"
          onClick={() => edit()}
          className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-base-300 px-3 py-2 text-left text-xs text-base-content/60 transition hover:border-accent/40 hover:bg-base-200/60"
        >
          <Server size={14} className="text-accent" />
          {t("mcp.empty")}
        </button>
      ) : (
        <div className="space-y-0.5">
          {servers.map((server) => (
            <div
              key={server.id}
              className="group flex items-center gap-1 rounded-xl px-2 py-1.5 text-base-content transition hover:bg-base-200"
            >
              <button
                type="button"
                onClick={() => edit(server)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-base-200 text-base-content/55">
                  <Server size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {server.name ||
                      (server.kind === "local" ? server.url : server.serverId)}
                  </span>
                  <span className="block truncate text-[10px] text-base-content/45">
                    {t(
                      server.kind === "local"
                        ? "mcp.kind_local_short"
                        : "mcp.kind_remote_short",
                    )}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => dispatch(removeMcpServer(server.id))}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-base-content/40 opacity-0 transition hover:bg-error/10 hover:text-error group-hover:opacity-100"
                title={t("mcp.remove")}
                aria-label={t("mcp.remove")}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
