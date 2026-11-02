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
  return async ({localState, setLocalState, formSubmission}) => {
    await sendMessage({
      localState,
      setLocalState,
      memories,
      dispatch,
      openModal,
      notifyError,
      notifySuccess,
      timeout,
      memoryMode,
      suggestUserPrompts,
      formSubmission,
      setTitleOnce,
    });
  };
}
