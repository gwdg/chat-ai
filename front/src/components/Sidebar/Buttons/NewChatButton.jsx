import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { useImportConversation } from "../../../hooks/useImportConversation";
import { AddFilled } from "@carbon/icons-react";
import { useToast } from "../../../hooks/useToast";
import ShortcutTooltip from "../ShortcutTooltip";
import { useModal } from "../../../modals/ModalContext";


export default function NewChatButton({
  variant = "icon",
  topicId = null,
  onNewConversation = null,
}) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const { openModal } = useModal();

  if (variant === "icon") {
    return (
      <button
        onClick={() => {onNewConversation(topicId);}}
        className="text-tertiary cursor-pointer flex-shrink-0 p-1.5 gap-1.5 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 flex items-center justify-center"
      >
        <AddFilled size={18} className="text-tertiary" />
        <span className="truncate text-xs font-semibold py-1 pr-1">
          {t("sidebar.new_conversation")}
        </span>
      </button>
    )
  }

  if (variant === "rail") {
    return (
      <ShortcutTooltip
        label={t("sidebar.new_conversation")}
        shortcut={t("sidebar.shortcut_new_conversation")}
      >
        <button
          onClick={() => {onNewConversation(topicId);}}
          className={`cursor-pointer p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 rounded-2xl flex items-center justify-center`}
          aria-label={t("sidebar.new_conversation")}
        >
          <AddFilled size={22} className="text-tertiary" />
        </button>
      </ShortcutTooltip>
    )
  }

  // Render sidebar button variant (with text)
  if (variant === "sidebar") {
    return (
      <>
        <button
          onClick={() => {onNewConversation(topicId);}}
          className={`cursor-pointer w-full text-black dark:text-white font-medium touch-manipulation transition-colors
            pl-2 pr-4 py-3 rounded-2xl flex items-center justify-start gap-3 text-sm text-tertiary
            hover:bg-gray-100 dark:hover:bg-gray-800
            `}
          style={{
            WebkitTapHighlightColor: "transparent"
          }}
        >
          <AddFilled size={22} className="text-tertiary" />
          <span className="truncate">
            {t("sidebar.new_conversation")}
          </span>
        </button>
      </>
    );
  }

  // Default fallback
  return null;
}
