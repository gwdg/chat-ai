import { useTranslation } from "react-i18next";
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
          className="cursor-pointer flex-shrink-0 p-1.5 rounded-2xl hover:bg-base-200 transition-all duration-200 flex items-center justify-center"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Bot size={20} className="text-accent" />
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
          className={`cursor-pointer p-2.5 hover:bg-success/10 hover:text-success rounded-2xl transition-all duration-200 flex items-center justify-center`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Bot size={22} className="text-accent" />
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
 hover:bg-base-200 text-base-content"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Bot size={24} className="text-accent" />
        </button>
      </ShortcutTooltip>
      </>
    );
  }

  // Default fallback
  return null;
}
