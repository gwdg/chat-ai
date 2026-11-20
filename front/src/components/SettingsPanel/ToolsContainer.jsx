// components/settings/ToolsContainer.jsx
import React, { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useModal } from "../../modals/ModalContext";
import { useDispatch, useSelector } from "react-redux";
import {
  selectAgreeWebSearch,
  agreeWebSearch,
} from "../../Redux/reducers/interfaceSettingsSlice";
import {
  selectGlobalMcpServers,
  selectMcpToolPolicy,
} from "../../Redux/reducers/userSettingsReducer";
import {
  BookOpen,
  CircleHelp,
  Globe,
  Image as ImageIcon,
  Wand2,
  AudioLines,
  Database,
  FileText,
  ScanEye,
  Server,
  TriangleAlert,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ArcanaContainer from "./ArcanaContainer";
import McpServerPicker from "./McpServerPicker";
import Tooltip from "../Others/Tooltip";
import { agentGatewayTools, isAgentEnabled, modelSupportsTools } from "../../apis/agentEndpoints";
import { mcpServers } from "../../agent/mcp";
import { isArcanasEnabled } from "../../utils/modules";

// Tools the agent has no counterpart for
const AGENT_UNAVAILABLE = new Set(
  agentGatewayTools() ? [] : ["arcana"],
);
// Agent tools that are off unless switched on: web search (agent/tools.ts), Arcana Tools
// (agent/arcanaTools.ts), arcana, which the gateway runs (agent/gateway.ts), and MCP servers
// (agent/mcp.ts). Writing files is part of Access storage (agent/storageAccess.ts).
const AGENT_OPT_IN = new Set([
  "web_search",
  "arcana",
  "arcana_tools",
  "mcp",
]);
// Tools that only exist in agent mode
const AGENT_ONLY = new Set([
  "create_docx",
  "image_analysis",
]);

export default function ToolsContainer({ localState, setLocalState }) {
  const { t } = useTranslation();
  const [detailKey, setDetailKey] = useState(null);
  const { openModal } = useModal();
  const dispatch = useDispatch();
  const agreedWebSearch = useSelector(selectAgreeWebSearch);
  const globalMcpServers = useSelector(selectGlobalMcpServers);
  const mcpToolPolicy = useSelector(selectMcpToolPolicy);
  
  const settings = localState?.settings || {};
  const modelName = settings?.model?.name;
  const isExternalModel =
    typeof modelName === "string" &&
    modelName.toLowerCase().includes("external");

  const toolsState = settings.tools || {};
  const toolsEnabled = !!settings.enable_tools && !isExternalModel;
  // In agent mode every tool is switched on its own and a missing key counts as on
  // (as in agent/tools.ts); the master switch and the server-side tools do not apply.
  const agentMode = isAgentEnabled();
  const agentWithoutTools = agentMode && !modelSupportsTools(settings?.model);
  const bulkActionsDisabled = agentMode ? agentWithoutTools : isExternalModel;
  const arcanasEnabled = isArcanasEnabled();

  // One switch for every configured MCP server.
  const mcpEnabled = !!toolsState.mcp;

  // Tool list (labels are translated)
  const TOOL_DEFS = useMemo(
    () => [
      { key: "web_search", Icon: Globe, label: t("settings.label_web_search") },
      {
        key: "image_generation",
        Icon: ImageIcon,
        label: t("settings.label_image_generation"),
      },
      {
        key: "image_modification",
        Icon: Wand2,
        label: t("settings.label_image_modification"),
      },
      {
        key: "audio_generation",
        Icon: AudioLines,
        label: t("settings.label_audio_generation"),
      },
      {
        key: "arcana_tools",
        Icon: Database,
        label: t("settings.label_arcana_tools"),
      },
      {
        key: "image_analysis",
        Icon: ScanEye,
        label: t("settings.label_image_analysis"),
      },
      {
        key: "create_docx",
        Icon: FileText,
        label: t("settings.label_create_docx"),
      },
      // The two with a settings page sit last: they are the ones you open, not tick.
      {
        key: "arcana",
        Icon: BookOpen,
        label: t("settings.label_arcana"),
        detail: true,
      },
      {
        key: "mcp",
        Icon: Server,
        label: t("mcp.section_title"),
        detail: true,
      },
    ],
    [t, arcanasEnabled]
  )
    .filter(({ key }) => agentMode || !AGENT_ONLY.has(key))
    .filter(
      ({ key }) =>
        arcanasEnabled || (key !== "arcana" && key !== "arcana_tools")
    );

  // Simple setter for per-tool flags
  const setTools = (patch) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, ...patch },
      },
      flush: true,
    }));
  };

  const toggleTool = (toolKey, nextValue) => {
    setTools({ [toolKey]: nextValue });
  };

  // Turning MCP support on without picking a server means "all configured servers", so the
  // picker shows every server ticked. An explicit selection, or a chat that still carries
  // legacy per-chat server entries, keeps what it has.
  const withAllMcpServers = (prev) => {
    const selected = Array.isArray(prev.settings?.mcp_local_server_ids)
      ? prev.settings.mcp_local_server_ids
      : [];
    if (selected.length > 0 || mcpServers(prev.settings).length > 0) return prev;
    const allIds = globalMcpServers.map((server) => server.id).filter(Boolean);
    if (!allIds.length) return prev;
    return {
      ...prev,
      settings: {
        ...prev.settings,
        mcp_local_server_ids: allIds,
      },
    };
  };

  const handleEnableAll = () => {
    const patch = { fetch_url: true };
    TOOL_DEFS.forEach(({ key }) => {
      patch[key] = true;
    });
    const apply = () =>
      setLocalState((prev) => {
        const next = withAllMcpServers(prev);
        return {
          ...next,
          settings: {
            ...next.settings,
            ...(agentMode ? {} : { enable_tools: true }),
            tools: { ...next.settings?.tools, ...patch },
          },
          flush: true,
        };
      });
    if (!agreedWebSearch) {
      openModal("disclaimerWebSearch", {
        onAgree: () => {
          apply();
          dispatch(agreeWebSearch());
        },
      });
      return;
    }
    apply();
  };

  const handleDisableAll = () => {
    const patch = { fetch_url: false };
    TOOL_DEFS.forEach(({ key }) => {
      patch[key] = false;
    });
    setTools(patch);
  };

  // First-time disclaimer for Web Search only
  const handleToggleWebSearch = (nextValue) => {
    if (nextValue && !agreedWebSearch) {
      openModal("disclaimerWebSearch", {
        onAgree: () => {
          toggleTool("web_search", true);
          toggleTool("fetch_url", true);
          dispatch(agreeWebSearch());
        },
      });
      return;
    }
    toggleTool("web_search", nextValue);
    toggleTool("fetch_url", nextValue);
  };

  // Arcana/MCP toggles
  const handleToggleArcana = (nextValue) => {
    toggleTool("arcana", nextValue);
  };
  const handleToggleMcp = (nextValue) => {
    if (!nextValue) {
      toggleTool("mcp", false);
      return;
    }
    setLocalState((prev) => {
      const next = withAllMcpServers(prev);
      return {
        ...next,
        settings: {
          ...next.settings,
          tools: { ...next.settings?.tools, mcp: true },
        },
        flush: true,
      };
    });
  };

  const getToolState = (key) => {
    const unavailable = agentMode && AGENT_UNAVAILABLE.has(key);
    const active =
      key === "mcp"
        ? mcpEnabled
        : !agentMode
          ? !!toolsState[key]
          : unavailable
            ? false
            : AGENT_OPT_IN.has(key)
              ? toolsState[key] === true
              : toolsState[key] !== false;
    const onToggle =
      key === "web_search"
        ? () => handleToggleWebSearch(!active)
        : key === "mcp"
          ? () => handleToggleMcp(!active)
          : () => toggleTool(key, !active);
    const disabled = agentMode
      ? unavailable || agentWithoutTools
      : !toolsEnabled;
    return { active, onToggle, disabled, unavailable };
  };

  const detailTool = detailKey
    ? TOOL_DEFS.find(({ key }) => key === detailKey)
    : null;
  const detailState = detailTool ? getToolState(detailTool.key) : null;

  const toolSwitch = ({
    active,
    onToggle,
    disabled,
    label,
    className = "",
    dataGuide,
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      data-guide={dataGuide}
      disabled={disabled}
      onClick={onToggle}
      className={[
        "inline-flex shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        className,
      ].join(" ")}
    >
      <input
        type="checkbox"
        readOnly
        checked={active}
        disabled={disabled}
        className="toggle toggle-sm toggle-success pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </button>
  );

  const warningTooltip = (key) =>
    key === "web_search" ? t("alert.web_search_usage") : t("alert.mcp_usage");

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex flex-row flex-wrap md:gap-4 gap-3 w-full md:items-center">
        <div className="flex-shrink-0 flex items-center gap-2">
          <p className="text-sm font-medium">{t("settings.tools_title")}</p>
          <CircleHelp
            className="h-[16px] w-[16px] cursor-pointer text-base-content/70"
            alt="help"
            onClick={() => openModal("helpTools")}
          />
        </div>

        {agentMode ? (
          agentWithoutTools && (
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300 select-none">
              {t("settings.tools_agent_external")}
            </span>
          )
        ) : (
        <div className="flex items-center gap-3 select-none">
          <button
            type="button"
            onClick={() =>
              setLocalState((prev) => ({
                ...prev,
                settings: { ...prev.settings, enable_tools: !toolsEnabled },
                flush: true,
              }))
            }
            disabled={isExternalModel}
            data-guide="tools-enable"
            className="inline-flex cursor-pointer disabled:cursor-not-allowed"
            aria-label={
              toolsEnabled
                ? t("settings.tools_enabled")
                : t("settings.tools_disabled")
            }
          >
            <input
              type="checkbox"
              aria-hidden="true"
              tabIndex={-1}
              readOnly
              checked={toolsEnabled}
              disabled={isExternalModel}
              className="toggle toggle-success pointer-events-none"
            />
          </button>

          {toolsEnabled ? (
            <span className="text-sm font-medium text-success">
              <Trans i18nKey="settings.tools_enabled">Tools are enabled</Trans>
            </span>
          ) : (
            <span className="text-sm font-medium text-base-content/70">
              <Trans i18nKey="settings.tools_disabled">Tools are disabled</Trans>
            </span>
          )}
        </div>
        )}
        {!detailKey && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={handleEnableAll}
              disabled={bulkActionsDisabled}
              className="btn btn-xs btn-ghost"
              data-guide="tools-enable-all"
            >
              {t("settings.tools_enable_all")}
            </button>
            <button
              type="button"
              onClick={handleDisableAll}
              disabled={bulkActionsDisabled}
              className="btn btn-xs btn-ghost"
              data-guide="tools-disable-all"
            >
              {t("settings.tools_disable_all")}
            </button>
          </div>
        )}
      </div>

      {detailTool ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDetailKey(null)}
              aria-label={t("common.back")}
              className="btn btn-ghost btn-xs btn-square"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="min-w-0 truncate text-sm font-medium">
              {detailTool.label}
            </p>
            {toolSwitch({
              active: detailState.active,
              onToggle: detailState.onToggle,
              disabled: detailState.disabled,
              label: detailTool.label,
              className: "ml-auto",
              dataGuide: `tool-${detailTool.key}`,
            })}
          </div>
          {detailState.active && !detailState.disabled ? (
            detailTool.key === "arcana" ? (
              <ArcanaContainer
                localState={localState}
                setLocalState={setLocalState}
              />
            ) : (
              <div className="space-y-3">
                {mcpToolPolicy === "never" && (
                  <p
                    className="rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-xs leading-relaxed text-base-content/80"
                    data-guide="mcp-tool-policy-notice"
                  >
                    {t("mcp.policy_never_notice")}
                  </p>
                )}
                <McpServerPicker
                  localState={localState}
                  setLocalState={setLocalState}
                />
              </div>
            )
          ) : (
            <p className="text-sm text-base-content/70">
              {t("settings.tools_enable_to_configure")}
            </p>
          )}
        </div>
      ) : (
        <ul
          data-guide="tools-grid"
          className="overflow-hidden rounded-xl border border-base-300 bg-base-100"
        >
          {TOOL_DEFS.map(({ key, Icon, label, detail }) => {
            const { active, onToggle, disabled, unavailable } =
              getToolState(key);
            const title = unavailable
              ? `${label}: ${t("settings.tools_agent_unavailable")}`
              : label;

            return (
              <li
                key={key}
                className="border-b border-base-300/70 last:border-b-0"
              >
                {detail ? (
                  <div className="flex w-full items-center gap-3 px-3 py-2.5 text-sm">
                    <button
                      type="button"
                      onClick={() => setDetailKey(key)}
                      aria-label={t("settings.tool_details", { name: label })}
                      data-guide={`tool-${key}`}
                      title={title}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                    >
                      <Icon
                        className="h-5 w-5 shrink-0 text-base-content/70"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {label}
                      </span>
                      {(key === "web_search" || key === "mcp") && (
                        <Tooltip text={warningTooltip(key)}>
                          <TriangleAlert
                            className="h-3.5 w-3.5 shrink-0 text-warning"
                            aria-hidden="true"
                          />
                        </Tooltip>
                      )}
                    </button>
                    {toolSwitch({ active, onToggle, disabled, label })}
                    <button
                      type="button"
                      onClick={() => setDetailKey(key)}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="shrink-0 cursor-pointer rounded p-0.5 text-base-content/50 hover:text-base-content"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onToggle}
                    disabled={disabled}
                    aria-pressed={active}
                    aria-label={label}
                    data-guide={`tool-${key}`}
                    title={title}
                    className={[
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm",
                      disabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer hover:bg-base-200",
                    ].join(" ")}
                  >
                    <Icon
                      className="h-5 w-5 shrink-0 text-base-content/70"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {label}
                    </span>
                    {(key === "web_search" || key === "mcp") && (
                      <Tooltip text={warningTooltip(key)}>
                        <TriangleAlert
                          className="h-3.5 w-3.5 shrink-0 text-warning"
                          aria-hidden="true"
                        />
                      </Tooltip>
                    )}
                    <input
                      type="checkbox"
                      aria-hidden="true"
                      tabIndex={-1}
                      readOnly
                      checked={active}
                      disabled={disabled}
                      className="toggle toggle-sm toggle-success pointer-events-none shrink-0"
                    />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
