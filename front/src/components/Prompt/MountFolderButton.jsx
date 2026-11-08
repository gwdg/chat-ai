import { Fragment, useEffect } from "react";
import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import { useTranslation } from "react-i18next";
import { Check, Code, FileText, Pencil, ScanEye, Server } from "lucide-react";
import { FolderAdd, ToolBox } from "@carbon/icons-react";
import Tooltip from "../Others/Tooltip";
import MCPContainer from "../SettingsPanel/MCPContainer";
import MiniToolButton from "../SettingsPanel/MiniToolButton";
import ToolLimit from "../SettingsPanel/ToolLimit";
import { useToast } from "../../hooks/useToast";
import { isAgentEnabled, modelSupportsTools } from "../../apis/agentEndpoints";
import { useModal } from "../../modals/ModalContext";
import { canMountLocalDirectory, mountLocalDirectory, setAccessPrompt } from "../../agent/workspace";

// Gives the agent access to local files: a folder shared for this conversation and the
// permission to write into the workspace. After a reload the browser forgets the folder
// permission; the agent then asks for it again through a dialog when it next uses the folder.
export default function MountFolderButton({ localState, setLocalState }) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const { openModal } = useModal();
  const agent = isAgentEnabled();
  const canMount = agent && canMountLocalDirectory();
  const writeAccess = localState?.settings?.tools?.write_access === true;
  const mcpEnabled = localState?.settings?.tools?.mcp === true;
  const createDocxEnabled = localState?.settings?.tools?.create_docx !== false;
  const codemodeEnabled = localState?.settings?.tools?.codemode !== false;
  const imageAnalysisEnabled = localState?.settings?.tools?.image_analysis !== false;
  const mcpDisabled = !modelSupportsTools(localState?.settings?.model);
  const showMcpConfig = mcpEnabled && !mcpDisabled;

  useEffect(() => {
    if (!canMount) return;
    setAccessPrompt(
      (handle) =>
        new Promise((resolve) =>
          openModal("folderAccess", {
            name: handle.name,
            onAllow: async () => {
              try {
                resolve((await handle.requestPermission({ mode: "readwrite" })) === "granted");
              } catch {
                resolve(false);
              }
            },
            onDeny: () => resolve(false),
          })
        )
    );
    return () => setAccessPrompt(null);
  }, [canMount, openModal]);

  if (!agent) return null;

  const handleMount = async () => {
    try {
      const at = await mountLocalDirectory(localState.id);
      if (at) notifySuccess(t("conversation.folder_mounted", { path: at }));
    } catch (error) {
      notifyError(error.message);
    }
  };

  const toggleWriteAccess = () =>
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, write_access: !writeAccess },
      },
      flush: true,
    }));

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
    if (mcpDisabled) return;
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
    if (mcpDisabled) return;
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        tools: { ...prev.settings?.tools, image_analysis: !imageAnalysisEnabled },
      },
      flush: true,
    }));
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
    const patch = canMount ? { write_access: true } : {};
    if (!mcpDisabled) {
      patch.mcp = true;
      patch.create_docx = true;
      patch.codemode = true;
      patch.image_analysis = true;
    }
    setTools(patch);
  };

  const disableAllTools = () => {
    const patch = { mcp: false, create_docx: false, codemode: false, image_analysis: false };
    if (canMount) patch.write_access = false;
    setTools(patch);
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
                {canMount && (
                  <div className="w-full select-none rounded-xl border border-base-300 bg-base-100 text-base-content">
                    <button
                      type="button"
                      onClick={() => {
                        handleMount();
                        close();
                      }}
                      data-guide="tool-share_local_folder"
                      title={t("conversation.mount_folder")}
                      className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-t-xl px-3 py-2 text-sm font-medium hover:bg-base-200 md:px-3.5 md:py-2.5"
                    >
                      <FolderAdd className="h-6 w-6 shrink-0 md:h-7 md:w-7" aria-hidden="true" />
                      <span className="leading-none text-xs text-center">
                        {t("conversation.mount_folder")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={toggleWriteAccess}
                      aria-pressed={writeAccess}
                      data-guide="tool-write_access"
                      className={[
                        "flex w-full cursor-pointer items-center gap-2 rounded-b-xl border-t border-base-300 px-2 py-1.5 text-[11px] font-medium text-left hover:bg-base-200",
                        writeAccess ? "text-success" : "text-base-content/70 hover:text-base-content",
                      ].join(" ")}
                    >
                      <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{t("settings.label_write_access")}</span>
                      {writeAccess && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                    </button>
                  </div>
                )}
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
                  disabled={mcpDisabled}
                  onClick={toggleCreateDocx}
                  Icon={FileText}
                  label={t("settings.label_create_docx")}
                  title={
                    mcpDisabled
                      ? `${t("settings.label_create_docx")}: ${t("settings.tools_agent_unavailable")}`
                      : undefined
                  }
                  guideKey="create_docx"
                />
                <MiniToolButton
                  active={imageAnalysisEnabled}
                  disabled={mcpDisabled}
                  onClick={toggleImageAnalysis}
                  Icon={ScanEye}
                  label={t("settings.label_image_analysis")}
                  title={
                    mcpDisabled
                      ? `${t("settings.label_image_analysis")}: ${t("settings.tools_agent_unavailable")}`
                      : undefined
                  }
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
                  <MCPContainer localState={localState} setLocalState={setLocalState} />
                </div>
              )}
            </div>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
