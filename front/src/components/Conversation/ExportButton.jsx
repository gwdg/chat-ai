import { useTranslation } from "react-i18next";
import Tooltip from "../Others/Tooltip";
import { Download } from "lucide-react";
import { useModal } from "../../modals/ModalContext";

export default function ExportButton({ localState, setLocalState }) {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;

  // Function to handle retry of last message
  const handleExport = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!localState?.id) return;
    // Flush changes
    setLocalState((prev) => ({
      ...prev,
      flush: true,
    }));
    openModal("exportConversation", {
      localState,
      conversationId: localState.id,
    });
    closeMenu();
  };

  return (
    <Tooltip text={t("common.export")}>
      <button
        className="h-[26px] w-[26px] cursor-pointer"
        onClick={handleExport}
        disabled={loading} // TODO handle loading
      >
        <Download className="cursor-pointer h-[26px] w-[26px] text-[#009EE0] hover:text-blue-600 transition-colors" />
      </button>
    </Tooltip>
  );
}
