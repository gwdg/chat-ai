import { useTranslation } from "react-i18next";
import { BrainstormFilled } from "@carbon/icons-react";
import { useToast } from "../../../hooks/useToast";
import ShortcutTooltip from "../ShortcutTooltip";
import { useModal } from "../../../modals/ModalContext";

export default function SummarizeChatButton({
  localState,
  setLocalState,
  variant = "rail",
  closeMenu = null,
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

  if (variant === "menu") {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                closeMenu();
                handleSummarizeChat();
            }}
            className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-base-content transition-colors hover:bg-base-200"
        >
            <BrainstormFilled size={14} />
            {t("common.summarize")}
        </button>
    )
  }
  if (variant === "rail") {
    return (
      <ShortcutTooltip
        label={t("common.summarize")}
    >
        <button
        onClick={handleSummarizeChat}
        className="btn btn-ghost btn-square hover:bg-success/10 hover:text-success"
        aria-label={t("common.summarize")}
        >
        <BrainstormFilled size={22} className="text-accent" />
        </button>
    </ShortcutTooltip>
    )
  }

  // Default fallback
  return null;
}
