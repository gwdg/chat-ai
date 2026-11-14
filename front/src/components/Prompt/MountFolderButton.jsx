import { Fragment } from "react";
import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { Code, FileText, ScanEye, Server } from "lucide-react";
import { ToolBox } from "@carbon/icons-react";
import Tooltip from "../Others/Tooltip";
import McpServerPicker from "../SettingsPanel/McpServerPicker";
import MiniToolButton from "../SettingsPanel/MiniToolButton";
import ToolLimit from "../SettingsPanel/ToolLimit";
import { isAgentEnabled, modelSupportsTools } from "../../apis/agentEndpoints";
import { useChatWorkspaces } from "../../db/workspaceDb";

// Local tools for the agent. File tools become available when a workspace is attached to the chat.
export default function MountFolderButton({ localState, setLocalState }) {
  const { t } = useTranslation();
  const agent = isAgentEnabled();
  const conversationId = localState?.id;
  const workspaceLinks = useChatWorkspaces(conversationId);
  const workspaceAttached = workspaceLinks.length > 0;
  const mcpEnabled = localState?.settings?.tools?.mcp === true;
  const createDocxEnabled = localState?.settings?.tools?.create_docx !== false;
  const codemodeEnabled = localState?.settings?.tools?.codemode !== false;
  const imageAnalysisEnabled = localState?.settings?.tools?.image_analysis !== false;
  const mcpDisabled = !modelSupportsTools(localState?.settings?.model);
  const showMcpConfig = mcpEnabled && !mcpDisabled;

  if (!agent) return null;

  const setMcp = (value) =>
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, mcp: value },
      },
      flush: true,
    }));

  const toggleMcp = () => {
    if (mcpDisabled) return;
    setMcp(!mcpEnabled);
  };

  const toggleCreateDocx = () => {
    if (mcpDisabled || !workspaceAttached) return;
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, create_docx: !createDocxEnabled },
      },
      flush: true,
    }));
  };

  const toggleCodemode = () => {
    if (mcpDisabled) return;
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, codemode: !codemodeEnabled },
      },
      flush: true,
    }));
  };

  const toggleImageAnalysis = () => {
    if (mcpDisabled || !workspaceAttached) return;
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, image_analysis: !imageAnalysisEnabled },
      },
      flush: true,
    }));
  };

  const dependencyTitle = (label) => {
    if (mcpDisabled) return `${label}: ${t("settings.tools_agent_unavailable")}`;
    if (!workspaceAttached) {
      return `${label}: ${t("settings.tools_requires_workspace")}`;
    }
    return undefined;
  };

  const setTools = (patch) =>
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, ...patch },
      },
      flush: true,
    }));

  const enableAllTools = () => {
    const patch = {};
    if (!mcpDisabled) {
      patch.mcp = true;
      patch.codemode = true;
      if (workspaceAttached) {
        patch.create_docx = true;
        patch.image_analysis = true;
      }
    }
    setTools(patch);
  };

  const disableAllTools = () => {
    setTools({
      mcp: false,
      create_docx: false,
      codemode: false,
      image_analysis: false,
    });
  };

  return (
    <Popover className="relative flex">
      <Tooltip text={t("conversation.local_tools")}>
        <PopoverButton
          data-guide="local-tools"
          className="h-[30px] w-[30px] flex items-center justify-center cursor-pointer focus:outline-none"
          aria-label={t("conversation.local_tools")}
        >
          <ToolBox size={24} className="text-accent" />
        </PopoverButton>
      </Tooltip>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel
          anchor="top start"
          className="z-50 mb-2 w-[39rem] max-w-[90vw] max-h-[70vh] overflow-y-auto rounded-2xl border border-base-300 bg-base-100 shadow-xl dark:shadow-dark p-4"
        >
          {({ close }) => (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{t("conversation.local_tools")}</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={enableAllTools}
                    className="btn btn-xs btn-ghost"
                    data-guide="local-tools-enable-all"
                  >
                    {t("settings.tools_enable_all")}
                  </button>
                  <button
                    type="button"
                    onClick={disableAllTools}
                    className="btn btn-xs btn-ghost"
                    data-guide="local-tools-disable-all"
                  >
                    {t("settings.tools_disable_all")}
                  </button>
                </div>
              </div>
              <div className="grid gap-2.5 sm:gap-3 grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]">
                <MiniToolButton
                  active={mcpEnabled}
                  disabled={mcpDisabled}
                  onClick={toggleMcp}
                  Icon={Server}
                  label={t("settings.label_mcp_server")}
                  title={
                    mcpDisabled
                      ? `${t("settings.label_mcp_server")}: ${t("settings.tools_agent_unavailable")}`
                      : undefined
                  }
                  guideKey="mcp_local"
                  warning
                />
                <MiniToolButton
                  active={createDocxEnabled}
                  disabled={mcpDisabled || !workspaceAttached}
                  onClick={toggleCreateDocx}
                  Icon={FileText}
                  label={t("settings.label_create_docx")}
                  title={dependencyTitle(t("settings.label_create_docx"))}
                  guideKey="create_docx"
                />
                <MiniToolButton
                  active={imageAnalysisEnabled}
                  disabled={mcpDisabled || !workspaceAttached}
                  onClick={toggleImageAnalysis}
                  Icon={ScanEye}
                  label={t("settings.label_image_analysis")}
                  title={dependencyTitle(t("settings.label_image_analysis"))}
                  guideKey="image_analysis"
                />
                <MiniToolButton
                  active={codemodeEnabled}
                  disabled={mcpDisabled}
                  onClick={toggleCodemode}
                  Icon={Code}
                  label={t("settings.label_codemode")}
                  title={
                    mcpDisabled
                      ? `${t("settings.label_codemode")}: ${t("settings.tools_agent_unavailable")}`
                      : undefined
                  }
                  guideKey="codemode"
                />
              </div>
              {!mcpDisabled && (
                <ToolLimit localState={localState} setLocalState={setLocalState} />
              )}
              {showMcpConfig && (
                <div className="border-t border-base-300 pt-3">
                  <McpServerPicker
                    localState={localState}
                    setLocalState={setLocalState}
                    kind="local"
                  />
                </div>
              )}
            </div>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
