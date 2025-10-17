// components/settings/MCPContainer.jsx
import { Trans, useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { useModal } from "../../modals/ModalContext";

const MCPContainer = ({ localState, setLocalState }) => {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const settings = localState.settings || {};

  const handleMCPChange = (e) => {
    setLocalState((prev) => ({
      ...prev,
      settings: { ...prev.settings, mcp_servers: e.target.value },
    }));
  };

  return settings?.enable_tools ? (
    <>
      <div className="flex gap-3 w-full items-center">
        <div className="flex-shrink-0 flex items-center gap-2 select-none">
          <p className="text-sm">{t("settings.label_mcp_server")}</p>
          <HelpCircle
            className="h-4 w-4 cursor-pointer text-[#009EE0]"
            alt="help"
            onClick={() => openModal("helpMCP")}
          />
        </div>
        <div className="w-full flex">
          <input
            type="text"
            value={settings?.mcp_servers || ""}
            onChange={handleMCPChange}
            placeholder={t("settings.placeholder_mcp_id")}
            className="dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border dark:border-border_dark outline-none rounded-lg shadow-lg dark:shadow-dark w-full max-h-[40px]"
          />
        </div>
      </div>

      {settings?.mcp_servers && (
        <div className="text-yellow-600 text-xs w-full select-none mt-1.5">
          <Trans i18nKey="alert.mcp_usage" />
        </div>
      )}
    </>
  ) : null;
};

export default MCPContainer;
