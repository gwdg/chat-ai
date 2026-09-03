import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { useImportConversation } from "../../../hooks/useImportConversation";
import { Bot } from "@carbon/icons-react";
import { useToast } from "../../../hooks/useToast";
import ShortcutTooltip from "../ShortcutTooltip";
import { useModal } from "../../../modals/ModalContext";


export default function ImportPersonaButton({
  variant = "icon",
  topicId = null,
}) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const { openModal } = useModal();

  if (variant === "icon") {
    return (
      <ShortcutTooltip label={t("sidebar.import_persona")}>
        <button
          onClick={() => {
            openModal("importPersona", {
              topicId: topicId,
            });
          }}
          aria-label={t("sidebar.import_persona")}
          className="cursor-pointer flex-shrink-0 p-1.5 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 flex items-center justify-center"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Bot size={20} className="text-tertiary" />
        </button>
      </ShortcutTooltip>
    )
  }

  if (variant === "rail") {
    return (
      <ShortcutTooltip label={t("sidebar.import_persona")}>
        <button
          onClick={() => {
            openModal("importPersona", {
              topicId: topicId,
            });
          }}
          aria-label={t("sidebar.import_persona")}
          className={`cursor-pointer p-2.5 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-2xl transition-all duration-200 flex items-center justify-center`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Bot size={22} className="text-tertiary" />
        </button>
      </ShortcutTooltip>
    )
  }

  // Render sidebar button variant (with text)
  if (variant === "sidebar") {
    return (
      <>
        <ShortcutTooltip label={t("sidebar.import_persona")}>
          <button
          onClick={() => {
            openModal("importPersona", {
              topicId: topicId,
            });
          }}
          aria-label={t("sidebar.import_persona")}
          className="cursor-pointer flex-shrink-0 p-2 rounded-2xl transition-all duration-200 flex items-center justify-center
            hover:bg-gray-100 dark:hover:bg-gray-800 text-black dark:text-white"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Bot size={24} className="text-tertiary" />
        </button>
      </ShortcutTooltip>
      </>
    );
  }

  // Default fallback
  return null;
}
