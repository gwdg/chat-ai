import { RotateCw } from "lucide-react";
import { useSendMessage } from "../../../hooks/useSendMessage";
import { useForkConversation } from "../../../hooks/useForkConversation";
import { useModal } from "../../../modals/ModalContext";

export default function RetryButton({
  localState,
  setLocalState,
  message_index,
}) {
  const sendMessage = useSendMessage();
  const { forkConversation } = useForkConversation(localState);
  const { openModal } = useModal();

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
  const handleRetry = () => {
    if (localState?.dontShow?.regenerate) {
      regenerate();
    } else {
      openModal("regenerateConfirm", {
        localState,
        setLocalState,
        regenerate,
        forkConversation: () => forkConversation(message_index),
      });
    }
  };

  return (
    <button onClick={handleRetry}>
      <RotateCw
        className="h-[18px] w-[18px] cursor-pointer text-[#009EE0]"
        alt="icon_retry"
      />
    </button>
  );
}
