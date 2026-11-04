import { useContext } from "react";
import { useSelector, useDispatch } from "react-redux";  
import sendMessage from "../utils/sendMessage";
import { useModal } from "../modals/ModalContext";
import { useToast } from "./useToast";
import { MetaChatSendContext } from "../context/MetaChatContext";
import {
  selectAllMemories,
  selectMemoryMode,
  selectSetTitleOnce,
  selectSuggestUserPrompts,
  selectTimeout,
} from "../Redux/reducers/userSettingsReducer";

export function useSendMessage() {
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const { notifyError, notifySuccess } = useToast();
  const timeout = useSelector(selectTimeout);
  const memories = useSelector(selectAllMemories);
  const memoryMode = useSelector(selectMemoryMode);
  const suggestUserPrompts = useSelector(selectSuggestUserPrompts);
  const setTitleOnce = useSelector(selectSetTitleOnce);
  const metaSendMessage = useContext(MetaChatSendContext);

  if (metaSendMessage) return metaSendMessage;

  // Make this async
  return async ({localState, setLocalState, formSubmission, speechMode = false}) => {
    const override = localState?.settings?.memory_mode_override;
    const effectiveMemoryMode =
      override === undefined || override === null || override === "default"
        ? memoryMode
        : [0, 1, 2].includes(Number(override))
          ? Number(override)
          : memoryMode;

    try {
      await sendMessage({
        localState,
        setLocalState,
        memories,
        dispatch,
        openModal,
        notifyError,
        notifySuccess,
        timeout,
        memoryMode: effectiveMemoryMode,
        suggestUserPrompts,
        formSubmission,
        setTitleOnce,
        speechMode,
      });
    } finally {
      window.dispatchEvent(new Event("chatai:message-complete"));
    }
  };
}
