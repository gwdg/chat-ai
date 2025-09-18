import { useState } from "react";
import { Trans } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { useModal } from "../../modals/ModalContext";

// Component for Arcana authentication inputs
const MCPContainer = ({ localState, setLocalState }) => {
  const { openModal } = useModal();
  const settings = localState.settings;
  const handleMCPChange = (e) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        mcp_servers: e.target.value,
      },
    }));
  };

  // const currentModel = useMemo(
  //   () => modelList?.find((m) => m.name === modelSettings["model-name"]),
  //   [modelList, modelSettings]
  // );
  const currentModel = settings.model;
  return settings?.enable_tools ||
    false ? (
    <>
      <div className="flex gap-4 w-full items-center">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
          <p className="text-sm">MCP Server</p>
          <HelpCircle
            className="h-[16px] w-[16px] cursor-pointer text-[#009EE0]"
            alt="help"
            onClick={() => openModal("helpMCP")}
          />
        </div>
        <div className="w-full flex gap-1">
          <input
            type="text"
            value={settings?.mcp_servers}
            onChange={handleMCPChange}
            placeholder="id"
            className="dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border dark:border-border_dark outline-none rounded-lg shadow-lg dark:shadow-dark w-full max-h-[40px]"
          />

          {/* <input
            type="text"
            value={localState.arcana.key}
            onChange={handleArcanaChange("key")}
            placeholder="key"
            className="dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border outline-none rounded-2xl shadow-lg dark:shadow-dark w-full max-h-[47px] dark:border-border_dark"
          /> */}
        </div>
      </div>
      {settings?.mcp_servers && (
          <div className="text-yellow-600 text-xs w-full select-none">
            <Trans i18nKey="alert.mcp_usage" />
          </div>
        )}
    </>
  ) : null;
};

export default MCPContainer;
