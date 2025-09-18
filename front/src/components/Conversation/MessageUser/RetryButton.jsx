import { useState, useEffect} from "react";
import { RotateCw } from "lucide-react";
import { useSendMessage } from "../../../hooks/useSendMessage";

export default function RetryButton({
  localState,
  setLocalState,
  message_index,
}) {
  const sendMessage = useSendMessage();

  // Function to handle resending a previous message
  const handleRetry = async () => {
    // Remove messages after current index
    let newState;
    setLocalState((prev) => {
      const newMessages = [...prev.messages];
      newMessages.splice(message_index + 1);
      newState = { ...prev, messages: newMessages }
      sendMessage({localState: newState, setLocalState});
      return { ...prev, messages: newMessages };
    });
  };

  return (
    <button onClick={handleRetry}>
      <RotateCw
        className="h-[22px] w-[22px] cursor-pointer text-[#009EE0]"
        alt="icon_retry"
      />
    </button>
  );
}
