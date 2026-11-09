import { useTranslation } from "react-i18next";
import BaseModal from "../BaseModal";

/**
 * Asks whether to connect to an MCP server whose reported name differs from the
 * name saved for it. Confirming connects and updates the saved name.
 */
export default function McpServerNameModal({
  isOpen,
  onClose,
  serverUrl,
  previousName,
  actualName,
  onConfirm,
  onCancel,
}) {
  const { t } = useTranslation();

  const cancel = () => {
    onCancel?.();
    onClose();
  };

  const confirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={cancel} titleKey="alert.mcp_name_changed_title">
      <div className="pt-0 pb-2">
        <p className="text-base-content text-justify text-sm">
          {t("alert.mcp_name_changed", {
            server: serverUrl,
            previousName,
            actualName,
          })}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-2 justify-between w-full text-sm mt-4">
        <button className="btn md:w-fit w-full min-w-[130px] select-none" onClick={cancel}>
          {t("common.cancel")}
        </button>
        <button className="btn btn-accent md:w-fit w-full min-w-[130px] select-none" onClick={confirm}>
          {t("alert.mcp_name_changed_connect")}
        </button>
      </div>
    </BaseModal>
  );
}
