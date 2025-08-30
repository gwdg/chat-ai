import { useSelector, useDispatch } from "react-redux";  
import sendMessage from "../utils/sendMessage";
import { useModal } from "../modals/ModalContext";
import { useToast } from "./useToast";
import { selectAllMemories, selectTimeout } from "../Redux/reducers/userSettingsReducer";

export function useSendMessage() {
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const { notifyError, notifySuccess } = useToast();
  const timeout = useSelector(selectTimeout);
  const memories = useSelector(selectAllMemories);

  // Make this async
  return async ({localState, setLocalState}) => {
    await sendMessage({
      localState,
      setLocalState,
      memories,
      dispatch,
      openModal,
      notifyError,
      notifySuccess,
      timeout,
    });
  };
}