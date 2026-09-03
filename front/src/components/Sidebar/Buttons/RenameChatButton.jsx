import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { useImportConversation } from "../../../hooks/useImportConversation";
import { Edit } from "@carbon/icons-react";
import { useToast } from "../../../hooks/useToast";
import ShortcutTooltip from "../ShortcutTooltip";
import { useModal } from "../../../modals/ModalContext";


export default function RenameChatButton({
  localState,
  setLocalState,
  variant = "rail",
  closeMenu = null,
  convId = null,
  conversations = null,
}) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const { openModal } = useModal();

  const handleRenameChat = (id, title) => {
    openModal("renameChat", {
      id: id,
      currentTitle: title,
      localState: localState,
      setLocalState: setLocalState,
    });
  };

  if (variant === "menu") {
    return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const conv = conversations?.find((c) => c.id === convId);
            handleRenameChat(convId, conv?.title || "Untitled Chat");
            closeMenu();
          }}
          className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Edit size={14} />
          {t("common.rename")}
        </button>
    )
  }

  if (variant === "rail") {
    return (
      <ShortcutTooltip
        label={t("sidebar.rename_tooltip", { title: localState?.title })}
      >
        <button
          onClick={() => {handleRenameChat(localState?.id, localState?.title || "Untitled Chat");}}
          className={`cursor-pointer p-2.5 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
          aria-label={t("sidebar.rename_tooltip", { title: localState?.title })}
        >
          <Edit size={22} className="text-tertiary" />
        </button>
      </ShortcutTooltip>
    )
  }

  // Default fallback
  return null;
}
