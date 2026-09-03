import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { TrashCan } from "@carbon/icons-react";
import { useToast } from "../../../hooks/useToast";
import ShortcutTooltip from "../ShortcutTooltip";
import { useModal } from "../../../modals/ModalContext";


export default function DeleteChatButton({
  localState,
  setLocalState,
  variant = "menu",
  closeMenu = null,
  convId = null,
  conversations = null,
}) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const { openModal } = useModal();

  const handleDeleteChat = () => {
    openModal("deleteChat", {
        id: convId,
        conversations,
        currentConversationId: localState?.id,
    });
  };

  if (variant === "menu") {
    return (
        <button
            onClick={(e) => {
            e.stopPropagation();
            handleDeleteChat();
            closeMenu();
            }}
            className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/30"
        >
            <TrashCan size={14} />
            {t("common.delete")}
        </button>
    )
  }

  // Default fallback
  return null;
}
