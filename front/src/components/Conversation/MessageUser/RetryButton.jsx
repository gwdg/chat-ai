import { useState, useCallback, useEffect} from "react";
import icon_retry from "../../../assets/icons/retry.svg";
import { useSendMessage } from "../../../hooks/useSendMessage";

export default function RetryButton({ localState, setLocalState, message_index }) {

    const sendMessage = useSendMessage();

    // Function to handle resending a previous message
    const handleRetry = async () => {
        // Remove messages after current index
        setLocalState(
            (prevState) => {
                const newMessages = [...prevState.messages];
                newMessages.splice(message_index + 1);
                return { ...prevState, messages: newMessages };
            }
        )
        // Retry sending the message
        await sendMessage({
            localState,
            setLocalState,
        });
    };

    return (
        <button
        onClick={handleRetry}
        >
        <img
            src={icon_retry}
            alt="icon_retry"
            className="h-[22px] w-[22px] cursor-pointer"
        />
        </button>
    );
}