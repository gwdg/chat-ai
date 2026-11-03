import { useTranslation } from "react-i18next";
import { Download } from "@carbon/icons-react";
import { useToast } from "../../../hooks/useToast";
import ShortcutTooltip from "../ShortcutTooltip";
import { useModal } from "../../../modals/ModalContext";


export default function ExportChatButton({
  localState,
  setLocalState,
  variant = "rail",
  closeMenu = null,
  convId = null,
}) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const { openModal } = useModal();

  const handleSummarizeChat = () => {
    openModal("summarizeChat", {
      localState: localState,
      setLocalState: setLocalState,
    });
  };

  const handleExportChat = () => {
    // Flush changes
    setLocalState((prev) => ({
      ...prev,
      flush: true,
    }));
    openModal("exportChat", {
      localState: localState,
      conversationId: convId || localState?.id,
    });
  };

  if (variant === "menu") {
    return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            closeMenu();
            handleExportChat();
          }}
          className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-base-content transition-colors hover:bg-base-200"
        >
          <Download size={14} />
          {t("export_conversation.export")}
        </button>
    )
  }
  if (variant === "rail") {
    return (
      <ShortcutTooltip
        label={t("common.export")}
      >
        <button
          onClick={handleExportChat}
          className="btn btn-ghost btn-square hover:bg-success/10 hover:text-success"
          aria-label={t("common.export")}
        >
          <Download size={22} className="text-accent" />
        </button>
      </ShortcutTooltip>
    )
  }

  // Default fallback
  return null;
}
