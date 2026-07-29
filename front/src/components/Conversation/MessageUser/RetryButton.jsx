import { RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSendMessage } from "../../../hooks/useSendMessage";
import { useModal } from "../../../modals/ModalContext";
import Tooltip from "../../Others/Tooltip";

export default function RetryButton({
  localState,
  setLocalState,
  message_index,
}) {
  const { t } = useTranslation();
  const sendMessage = useSendMessage();
  const { confirmAction } = useModal();

  // Drop the current response (and everything after this message), then
  // resend using the conversation's *current* settings.
  const regenerate = () => {
    const newMessages = [...localState.messages];
    newMessages.splice(message_index + 1);
    const newState = { ...localState, messages: newMessages, flush: true };
    setLocalState(newState);
    sendMessage({ localState: newState, setLocalState });
  };

  // Regenerating is destructive (subsequent messages are lost), so confirm
  // first unless the user opted out.
  const handleRetry = () =>
    confirmAction(
      {
        warningKey: "warn_regenerate",
        messageKey: "alert.regenerate_confirm",
        confirmKey: "alert.regenerate_yes",
        danger: true,
      },
      regenerate
    );

  return (
    <Tooltip text={t("common.regenerate")}>
      <button onClick={handleRetry} className="flex">
        <RotateCw
          className="h-[22px] w-[22px] cursor-pointer text-[#009EE0]"
          alt="icon_retry"
        />
      </button>
    </Tooltip>
  );
}
