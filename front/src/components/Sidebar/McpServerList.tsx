import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from "@headlessui/react";
import {
  Edit,
  OverflowMenuVertical,
  TrashCan,
} from "@carbon/icons-react";
import { ChevronDown, Plus, Server, TriangleAlert } from "lucide-react";

import Tooltip from "../Others/Tooltip";

import { useModal } from "../../modals/ModalContext";
import {
  removeMcpServer,
  selectGlobalMcpServers,
} from "../../Redux/reducers/userSettingsReducer";
import {
  selectCollapsedTopics,
  toggleTopic,
} from "../../Redux/reducers/interfaceSettingsSlice";
import { normalizeMcpUrl } from "../../agent/mcp";
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
          <Tooltip text={t("mcp.tooltip")}>
            <span className="truncate">{t("mcp.section_title")}</span>
          </Tooltip>
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
              <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
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
                {server.kind === "local" && !normalizeMcpUrl(server.url) && (
                  <span
                    className="shrink-0 text-warning"
                    title={t("mcp.invalid_url")}
                    aria-label={t("mcp.invalid_url")}
                  >
                    <TriangleAlert size={13} />
                  </span>
                )}
              </span>
              <Popover className="relative shrink-0">
                <PopoverButton
                  className={`flex h-6 w-6 items-center justify-center rounded-md text-base-content/40 transition hover:bg-base-300 hover:text-base-content focus:opacity-100 group-hover:opacity-100 ${
                    window.innerWidth < 1024 ? "opacity-100" : "opacity-0"
                  }`}
                  title={t("mcp.options")}
                  aria-label={t("mcp.options")}
                >
                  <OverflowMenuVertical size={16} />
                </PopoverButton>
                <PopoverPanel
                  anchor="bottom end"
                  className="z-50 w-44 rounded-xl border border-base-300 bg-base-100 p-1 shadow-lg"
                >
                  {({ close }) => (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          edit(server);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/80 transition hover:bg-base-200"
                      >
                        <Edit size={14} />
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          dispatch(removeMcpServer(server.id));
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-error transition hover:bg-error/10"
                      >
                        <TrashCan size={14} />
                        {t("mcp.remove")}
                      </button>
                    </>
                  )}
                </PopoverPanel>
              </Popover>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
