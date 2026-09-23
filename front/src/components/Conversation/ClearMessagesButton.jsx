import { useTranslation } from "react-i18next";
import Tooltip from "../Others/Tooltip";
import { X } from "lucide-react"
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";

export default function ClearMessagesButton({localState, setLocalState}) {
  const { t } = useTranslation();
  const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;
  const { confirmAction } = useModal();
  const {notifySuccess, notifyError } = useToast();

  // Clear conversation history
  const clearMessages = () => {
    setLocalState((prev) => ({
      ...prev,
      messages:
        prev.messages.length >= 2
          ? [prev.messages[0], prev.messages[prev.messages.length-1]] // Keep only system message and prompt
          : prev.messages,
    }));

    notifySuccess("Messages cleared");
  };

  // Clearing is destructive, so confirm first unless the user opted out.
  const handleClearHistory = () =>
    confirmAction(
      {
        warningKey: "warn_clear_history",
        messageKey: "alert.clear_messages",
        confirmKey: "alert.yes",
        danger: true,
      },
      clearMessages
    );

  return (
    <Tooltip text={t("common.clear")}>
      <button
        className="h-[26px] w-[26px] cursor-pointer"
        disabled={loading}
        onClick={handleClearHistory}
      >
        <X
          className="cursor-pointer h-[26px] w-[26px] text-[#009EE0] hover:text-red-500 transition-colors"
        />
      </button>
    </Tooltip>
  );
};
