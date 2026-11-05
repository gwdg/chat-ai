// components/settings/ToolsContainer.jsx
import React, { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useModal } from "../../modals/ModalContext";
import { useDispatch, useSelector } from "react-redux";
import {
  selectAgreeWebSearch,
  agreeWebSearch,
} from "../../Redux/reducers/interfaceSettingsSlice";
import {
  CircleHelp,
  Globe,
  Image as ImageIcon,
  Wand2,
  AudioLines,
  Server, // MCP
  Code,
  FileText,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen } from "@fortawesome/free-solid-svg-icons";
import ArcanaContainer from "./ArcanaContainer";
import MCPContainer from "./MCPContainer";
import MiniToolButton from "./MiniToolButton";
import { agentGatewayTools, isAgentEnabled, modelSupportsTools } from "../../apis/agentEndpoints";
import { hasMcpServerValue } from "../../agent/mcp";

// Tools the agent has no counterpart for
const AGENT_UNAVAILABLE = new Set([...(agentGatewayTools() ? [] : ["arcana"])]);
// Agent tools that are off unless switched on: web search and writing files (agent/tools.ts),
// arcana, which the gateway runs (agent/gateway.ts), and MCP servers (agent/mcp.ts)
const AGENT_OPT_IN = new Set(["web_search", "arcana", "write_access", "mcp"]);
// Tools that only exist in agent mode
const AGENT_ONLY = new Set(["write_access", "codemode", "create_docx"]);

// Tool invocations per agent response; batched calls count once. Stored as
// settings.max_tool_calls: missing = 10, 0 = no limit (agent/runAgent.ts).
const DEFAULT_TOOL_LIMIT = 10;
function ToolLimit({ localState, setLocalState }) {
  const { t } = useTranslation();
  const value = localState?.settings?.max_tool_calls ?? DEFAULT_TOOL_LIMIT;
  const limited = value > 0;
  const set = (max_tool_calls) =>
    setLocalState((prev) => ({ ...prev, settings: { ...prev.settings, max_tool_calls }, flush: true }));

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm select-none">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={limited}
          onChange={() => set(limited ? 0 : DEFAULT_TOOL_LIMIT)}
          className="h-4 w-4 accent-primary"
        />
        {t("settings.label_tool_limit")}
      </label>
      {limited && (
        <input
          type="number"
          min={1}
          value={value}
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value));
            if (n >= 1) set(n);
          }}
          aria-label={t("settings.label_tool_limit")}
          title={t("settings.tool_limit_hint")}
          className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-bg_dark px-2 py-1"
        />
      )}
    </div>
  );
}

export default function ToolsContainer({ localState, setLocalState }) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const dispatch = useDispatch();
  const agreedWebSearch = useSelector(selectAgreeWebSearch);
  
  const settings = localState?.settings || {};
  const modelName = settings?.model?.name;
  const isExternalModel =
    typeof modelName === "string" &&
    modelName.toLowerCase().includes("external");

  const toolsState = settings.tools || {};
  const toolsEnabled = !!settings.enable_tools && !isExternalModel;
  const hasMcpServers = hasMcpServerValue(settings.mcp_servers);
  // In agent mode every tool is switched on its own and a missing key counts as on
  // (as in agent/tools.ts); the master switch and the server-side tools do not apply.
  const agentMode = isAgentEnabled();
  const agentWithoutTools = agentMode && !modelSupportsTools(settings?.model);

  const showArcanaBox = agentMode
    ? agentGatewayTools() && toolsState.arcana === true
    : !!settings?.enable_tools && !!toolsState.arcana;
  const showMCPBox =
    (agentMode ? !agentWithoutTools : !!settings?.enable_tools) && !!toolsState.mcp;

  // Tool list (labels are translated)
  const TOOL_DEFS = useMemo(
    () => [
      { key: "codemode", Icon: Code, label: t("settings.label_codemode") },
      { key: "create_docx", Icon: FileText, label: t("settings.label_create_docx") },
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
        key: "arcana",
        Icon: ({ className = "", ...rest }) => (
          <FontAwesomeIcon
            icon={faBookOpen}
            className={[
              "leading-none",
              "text-[18px] md:text-[22px] lg:text-[26px]",
              className,
            ].join(" ")}
            {...rest}
          />
        ),
        label: t("settings.label_arcana"),
      },
      { key: "mcp",
        Icon: Server,
        label: t("settings.label_mcp_server")
      },
    ],
    [t]
  ).filter(({ key }) => agentMode || !AGENT_ONLY.has(key));

  // Simple setter for per-tool flags
  const toggleTool = (toolKey, nextValue) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, [toolKey]: nextValue },
      },
      flush: true,
    }));
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
  const handleToggleMCP = (nextValue) => {
    toggleTool("mcp", nextValue);
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex flex-row md:gap-4 gap-3 w-full md:items-center">
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
        <div className="w-full flex items-center gap-3 select-none">
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
      </div>

      {/* Compact, responsive grid */}
      <div
        data-guide="tools-grid"
        className={[
          "grid gap-2.5 sm:gap-3",
          "grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]",
        ].join(" ")}
      >
        {TOOL_DEFS.map(({ key, Icon, label }) => {
          const unavailable = agentMode && AGENT_UNAVAILABLE.has(key);
          const active = !agentMode
            ? !!toolsState[key]
            : unavailable
              ? false
              : AGENT_OPT_IN.has(key)
                ? toolsState[key] === true
                : toolsState[key] !== false;
          const onToggle =
            key === "web_search"
              ? () => handleToggleWebSearch(!active)
              : () => toggleTool(key, !active);

          return (
            <MiniToolButton
              key={key}
              active={active}
              disabled={agentMode ? unavailable || agentWithoutTools : !toolsEnabled}
              onClick={onToggle}
              Icon={Icon}
              label={label}
              title={unavailable ? `${label}: ${t("settings.tools_agent_unavailable")}` : label}
              guideKey={key}
              warning={key === "web_search" || (key === "mcp" && hasMcpServers)}
            />
          );
        })}
      </div>
      {agentMode && !agentWithoutTools && (
        <ToolLimit localState={localState} setLocalState={setLocalState} />
      )}
      {/* Arcana box (only when enabled AND has an ID) */}
      {showArcanaBox && (
        <ArcanaContainer
          localState={localState}
          setLocalState={setLocalState}
        />
      )}
      {/* MCP box (only when enabled AND has a value) */}
      {showMCPBox && (
        <MCPContainer
          localState={localState}
          setLocalState={setLocalState}
          remote
        />
      )}
    </div>
  );
}
